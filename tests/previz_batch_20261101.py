from pathlib import Path
import os, time, json, hashlib, traceback
import numpy as np, cv2
from ultralytics import YOLO, SAM
src=Path("/tmp/previs/input_12p3_15p7.mp4")
out=Path("output"); out.mkdir(exist_ok=True)
sha=hashlib.sha256(src.read_bytes()).hexdigest()
assert sha==os.environ["EXPECTED_SHA256"],"input sha mismatch"
cap=cv2.VideoCapture(str(src))
fps=cap.get(cv2.CAP_PROP_FPS)
allframes=[]
while True:
  ok,fr=cap.read()
  if not ok: break
  allframes.append(fr)
cap.release()
assert len(allframes)>30
h,w=allframes[0].shape[:2]
step=max(1,round(fps/6))
frames=allframes[::step]
fps2=fps/step
print("INPUT",len(allframes),len(frames),w,h,"fps",fps2,flush=True)
colors=[(248,134,91),(49,217,249),(75,229,101),(250,132,226),(202,176,56),(116,117,246),(213,97,72),(170,198,227)]
bones=[(5,7),(7,9),(6,8),(8,10),(5,6),(5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16),(0,1),(0,2),(1,3),(2,4)]
model_defs=[("sseg","yolo11s-seg.pt",896),("mseg","yolo11m-seg.pt",1024),("spose","yolo11s-pose.pt",896),("mpose","yolo11m-pose.pt",1024)]
models={}; predictions={}; tests={}
for name,weight,res in model_defs:
  try:
    t=time.monotonic()
    model=YOLO(weight)
    models[name]=model
    preds=[]
    for frame in frames:
      pred=model.track(frame,classes=[0],conf=.13,iou=.62,imgsz=res,verbose=False,persist=True,tracker="bytetrack.yaml")[0]
      preds.append(pred)
    prediction_counts=[len(p.boxes) if p.boxes is not None else 0 for p in preds]
    info={"model":weight,"success":True,"seconds":round(time.monotonic()-t,2),"count_by_frame":prediction_counts,"mean_detections":round(float(np.mean(prediction_counts)),2),"max_detections":max(prediction_counts)}
    if "pose" in name:
      points=[p.keypoints.conf.cpu().numpy() if p.keypoints is not None and p.keypoints.conf is not None else np.empty((0,17)) for p in preds]
      legs=[float(np.mean([(k[:,13:17]>.30).mean() for k in points if k.size]))] if any(k.size for k in points) else [0]
      info["visible_leg_joint_fraction"]=round(legs[0],3)
    predictions[name]=preds;tests[name]=info
    print("MODEL_OK",name,json.dumps(info),flush=True)
  except Exception as e:
    tests[name]={"success":False,"error":repr(e)}
    print("MODEL_FAILED",name,repr(e),flush=True)
assert "mpose" in predictions or "spose" in predictions,"no pose model succeeded"
def get_ids(p):
  if p.boxes is None:return []
  if p.boxes.id is not None:return p.boxes.id.int().cpu().tolist()
  return list(range(len(p.boxes)))
def masks_from(pred):
  if pred is None or pred.masks is None or pred.boxes is None:return []
  m=pred.masks.data.cpu().numpy()
  xy=pred.boxes.xyxy.cpu().numpy()
  ids=get_ids(pred)
  outm=[]
  for i,x in enumerate(m):
    if x.shape!=(h,w): x=cv2.resize(x,(w,h),interpolation=cv2.INTER_NEAREST)
    if np.sum(x>.45)<65:continue
    outm.append((ids[i],x>.45,xy[i]))
  return outm
def base():
  a=np.zeros((h,w,3),dtype=np.uint8);a[:]=(81,81,81)
  cv2.line(a,(0,int(h*.19)),(w-1,int(h*.19)),(125,125,125),1)
  cv2.line(a,(0,int(h*.78)),(w-1,int(h*.78)),(125,125,125),1)
  return a
def draw_mask(view,p):
  for trackid,mask,box in masks_from(p):
    color=colors[trackid%len(colors)]
    view[mask]=color
    cv2.putText(view,"P"+str(trackid),(max(0,int(box[0])),max(145,int(box[1]))),cv2.FONT_HERSHEY_SIMPLEX,.58,(255,255,255),2,cv2.LINE_AA)
  return view
def pose_people(p):
  if p is None or p.keypoints is None or p.keypoints.conf is None or p.boxes is None:return []
  return [(ident,box,np.asarray(x),np.asarray(conf)) for ident,box,x,conf in zip(get_ids(p),p.boxes.xyxy.cpu().numpy(),p.keypoints.xy.cpu().numpy(),p.keypoints.conf.cpu().numpy())]
def bbox_iou(x,y):
  xa,ya=max(x[0],y[0]),max(x[1],y[1]);xb,yb=min(x[2],y[2]),min(x[3],y[3])
  overlap=max(0,xb-xa)*max(0,yb-ya)
  sa=max(0,x[2]-x[0])*max(0,x[3]-x[1]);sb=max(0,y[2]-y[0])*max(0,y[3]-y[1])
  return overlap/max(sa+sb-overlap,1)
def draw_pose(view,p,seg=None):
  sm=masks_from(seg)
  for trackid,box,xy,conf in pose_people(p):
    if sm:
      best=max(sm,key=lambda z:bbox_iou(z[2],box))
      if bbox_iou(best[2],box)>.25:trackid=best[0]
    color=colors[trackid%len(colors)]
    for i,j in bones:
      if conf[i]>.28 and conf[j]>.28:
        pa=tuple(np.rint(xy[i]).astype(int));pb=tuple(np.rint(xy[j]).astype(int))
        cv2.line(view,pa,pb,(29,29,29),7,cv2.LINE_AA)
        cv2.line(view,pa,pb,color,4,cv2.LINE_AA)
    for i in range(17):
      if conf[i]>.28:
        pos=tuple(np.rint(xy[i]).astype(int))
        cv2.circle(view,pos,4,(0,0,0),-1,cv2.LINE_AA)
        cv2.circle(view,pos,3,(255,255,255),-1,cv2.LINE_AA)
    neck=(xy[5]+xy[6])/2
    if max(conf[5],conf[6])>.25:cv2.putText(view,"P"+str(trackid),(int(neck[0]),max(148,int(neck[1])-12)),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),2,cv2.LINE_AA)
  return view
def label(img,s):
  cv2.rectangle(img,(0,0),(w,26),(23,23,23),-1)
  cv2.putText(img,s,(8,19),cv2.FONT_HERSHEY_SIMPLEX,.50,(255,255,255),1,cv2.LINE_AA)
  return img
names=["01_seg_small","02_seg_medium","03_pose_medium","04_fusion_pose_mask","05_comparison"]
writers={}
for name in names:
  ww=w*3 if name=="05_comparison" else w
  writers[name]=cv2.VideoWriter(str(out/(name+".mp4")),cv2.VideoWriter_fourcc(*"mp4v"),fps2,(ww,h))
contact=[]
for k,fr in enumerate(frames):
  sseg=predictions.get("sseg",[]);mseg=predictions.get("mseg",[])
  ppred=predictions.get("mpose",predictions.get("spose",[]))
  small=label(draw_mask(base(),sseg[k] if sseg else None),"A - small masks")
  medium=label(draw_mask(base(),mseg[k] if mseg else None),"B - stronger masks")
  pose=label(draw_pose(base(),ppred[k] if ppred else None),"C - joint motion")
  mix=label(draw_pose(draw_mask(base(),mseg[k] if mseg else (sseg[k] if sseg else None)),ppred[k] if ppred else None,mseg[k] if mseg else (sseg[k] if sseg else None)),"D - masks + joints")
  writers["01_seg_small"].write(small);writers["02_seg_medium"].write(medium);writers["03_pose_medium"].write(pose);writers["04_fusion_pose_mask"].write(mix)
  comparison=np.hstack((fr,pose,mix));writers["05_comparison"].write(comparison)
  if k in [0,6,10,14,18]:
    contact.append(np.hstack((fr,small,medium,pose,mix)))
for wr in writers.values():wr.release()
if contact:
  stack=np.vstack(contact)
  targetw=1080
  cv2.imwrite(str(out/"AI_방식별_비교.jpg"),cv2.resize(stack,(targetw,int(stack.shape[0]*targetw/stack.shape[1]))))
tests["sam2"]={"success":False,"note":"not attempted"}
try:
  st=time.monotonic()
  sampler=SAM("sam2.1_t.pt")
  results=[]
  keyidx=[min(12,len(frames)-1),min(17,len(frames)-1)]
  for i in keyidx:
    pred=predictions.get("mseg",predictions.get("sseg"))[i]
    boxes=pred.boxes.xyxy.cpu().numpy() if pred.boxes is not None else np.empty((0,4))
    boxes=[b.tolist() for b in boxes if b[1]<.75*h and b[3]>.25*h][:4]
    if not boxes:continue
    res=sampler(frames[i],bboxes=boxes,verbose=False,save=False)[0]
    view=base()
    masks=masks_from(res)
    for j,(_,mask,_) in enumerate(masks):view[mask]=colors[j%len(colors)]
    results.append(np.hstack((frames[i],view)))
  if results:cv2.imwrite(str(out/"SAM2_보정_비교.jpg"),np.vstack(results))
  tests["sam2"]={"success":bool(results),"seconds":round(time.monotonic()-st,2),"refined_frames":len(results),"weights":"sam2.1_t.pt"}
  print("SAM2_OK",tests["sam2"],flush=True)
except Exception as exc:
  tests["sam2"]={"success":False,"error":repr(exc)}
  print("SAM2_FAILED",repr(exc),flush=True)
summary={"input_sha256":sha,"input_duration":round(len(allframes)/fps,3),"frames_tested":len(frames),"fps_output":round(fps2,2),"model_comparisons":tests,"real_people_detected":True,"3d_mannequin_created":False,"known_occlusion":"overlaid text blocks lower limbs; cannot reconstruct invisible body from segmentation alone","quality":"await visual review; no automatic success claim"}
(out/"방식일괄실험_결과.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
print("BATCH_COMPLETE",json.dumps(summary,ensure_ascii=False),flush=True)
