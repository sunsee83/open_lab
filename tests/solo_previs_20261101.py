from pathlib import Path
from ultralytics import YOLO
import cv2, numpy as np, json, hashlib, time
src=Path("input/solo_original_6s.mp4"); out=Path("output"); out.mkdir(exist_ok=True)
assert src.exists() and src.stat().st_size>100000
cap=cv2.VideoCapture(str(src))
fps=cap.get(cv2.CAP_PROP_FPS);nframes=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));assert fps>10 and nframes>40
W,H=960,540
step=max(1,round(fps/8))
frames=[]
for i in range(nframes):
 ok,frame=cap.read()
 if not ok:break
 if i%step==0:frames.append(cv2.resize(frame,(W,H),interpolation=cv2.INTER_AREA))
cap.release()
assert len(frames)>12
print("VIDEO_READ",len(frames),"FPS",fps/step,flush=True)
start=time.monotonic()
pose=YOLO("yolo11s-pose.pt");seg=YOLO("yolo11s-seg.pt")
ps=[];ss=[]
for fr in frames:
 ps.append(pose.predict(fr,conf=.18,imgsz=960,classes=[0],verbose=False)[0])
 ss.append(seg.predict(fr,conf=.18,imgsz=960,classes=[0],verbose=False)[0])
print("MODELS_PROCESSED",round(time.monotonic()-start,1),flush=True)
bones=[(5,6),(5,7),(7,9),(6,8),(8,10),(5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16)]
colors={"body":(195,105,231),"arms":(51,217,248),"legs":(74,217,117),"head":(251,177,92)}
previous=None;missed=0;rows=[];measure=[]
writer=cv2.VideoWriter("output/01_원본_실루엣_마네킹.mp4",cv2.VideoWriter_fourcc(*"mp4v"),fps/step,(W*3,H))
for k,(fr,p,s) in enumerate(zip(frames,ps,ss)):
 bg=np.full_like(fr,81);bg[:int(.80*H),:]=(89,89,89)
 cv2.line(bg,(0,int(.80*H)),(W,int(.80*H)),(135,135,135),2)
 sil=bg.copy();avatar=bg.copy();maskarea=0
 if s.boxes is not None and len(s.boxes)>0 and s.masks is not None:
  boxes=s.boxes.xyxy.cpu().numpy()
  idx=int(np.argmax((boxes[:,2]-boxes[:,0])*(boxes[:,3]-boxes[:,1])))
  mask=cv2.resize(s.masks.data[idx].cpu().numpy(),(W,H),interpolation=cv2.INTER_LINEAR)>.5
  sil[mask]=(50,201,242);maskarea=int(mask.sum())
 pose_detect=False;carry=False
 if p.boxes is not None and len(p.boxes)>0 and p.keypoints is not None and p.keypoints.conf is not None:
  boxes=p.boxes.xyxy.cpu().numpy()
  idx=int(np.argmax((boxes[:,2]-boxes[:,0])*(boxes[:,3]-boxes[:,1])))
  xy=p.keypoints.xy[idx].cpu().numpy();cf=p.keypoints.conf[idx].cpu().numpy()
  if previous is not None:
   oldxy,oldcf=previous
   good=(cf>.4)&(oldcf>.4)
   xy[good]=.75*xy[good]+.25*oldxy[good]
  previous=(xy.copy(),cf.copy());missed=0;pose_detect=True
 elif previous is not None and missed<1:
  xy,cf=previous;cf=cf*.65;missed+=1;carry=True
 else:
  xy=np.zeros((17,2),np.float32);cf=np.zeros(17,np.float32);missed+=1
 good=cf>.37
 for a,b in bones:
  if good[a] and good[b]:
   A=tuple(np.rint(xy[a]).astype(int));B=tuple(np.rint(xy[b]).astype(int))
   group="arms" if a in [5,6,7,8] and b in [7,8,9,10] else "legs" if a>=11 and b>=13 else "body"
   thick=18 if group=="body" else 13 if group=="legs" else 11
   cv2.line(avatar,A,B,(26,26,26),thick+4,cv2.LINE_AA)
   cv2.line(avatar,A,B,colors[group],thick,cv2.LINE_AA)
 if all(good[i] for i in [5,6,11,12]):
  poly=np.rint(xy[[5,6,12,11]]).astype(np.int32)
  cv2.fillConvexPoly(avatar,poly,colors["body"],cv2.LINE_AA)
  cv2.polylines(avatar,[poly],True,(45,45,45),2,cv2.LINE_AA)
 if good[0]:
  r=16
  if good[5] and good[6]:r=int(np.clip(np.linalg.norm(xy[5]-xy[6])*.38,11,27))
  c=(int(xy[0,0]),int(xy[0,1]-r*.25))
  cv2.circle(avatar,c,r+2,(30,30,30),-1,cv2.LINE_AA)
  cv2.circle(avatar,c,r,colors["head"],-1,cv2.LINE_AA)
 for i in [5,6,7,8,9,10,11,12,13,14,15,16]:
  if good[i]:cv2.circle(avatar,tuple(np.rint(xy[i]).astype(int)),4,(245,245,245),-1,cv2.LINE_AA)
 orig=fr.copy()
 for canvas,caption in ((orig,"ORIGINAL"),(sil,"PERSON MASK"),(avatar,"POSE-DRIVEN AVATAR")):
  cv2.rectangle(canvas,(0,0),(W,35),(35,35,35),-1)
  cv2.putText(canvas,caption,(8,24),cv2.FONT_HERSHEY_SIMPLEX,.63,(255,255,255),2,cv2.LINE_AA)
 comparison=np.hstack((orig,sil,avatar));writer.write(comparison)
 if k in [0,8,16,24,32,40]:
  rows.append(cv2.resize(comparison,(810,round(H*810/(W*3))),interpolation=cv2.INTER_AREA))
 measure.append({"frame":k,"pose_detected":pose_detect,"interpolated":carry,"visible_arm_joints_6":int(np.sum(good[[5,6,7,8,9,10]])),"visible_leg_joints_6":int(np.sum(good[[11,12,13,14,15,16]])),"mask_pixels":maskarea})
writer.release()
if rows:cv2.imwrite("output/02_시간순_비교.jpg",np.vstack(rows))
summary={"source_url":"https://www.pexels.com/video/a-woman-dancing-at-home-6003772/","source_video_sha256":hashlib.sha256(src.read_bytes()).hexdigest(),"input_duration_sec":len(frames)*step/fps,"frames_tested":len(frames),"pose_detection_frames":sum(x["pose_detected"] for x in measure),"mask_detection_frames":sum(x["mask_pixels"]>250 for x in measure),"avg_arm_joints_of_6":round(float(np.mean([x["visible_arm_joints_6"] for x in measure])),2),"avg_leg_joints_of_6":round(float(np.mean([x["visible_leg_joints_6"] for x in measure])),2),"full_6_leg_joints_frames":sum(x["visible_leg_joints_6"]==6 for x in measure),"model":"YOLO11s-pose + YOLO11s-seg pretrained","meaning":"2D pose-driven mannequin, not a 3D motion capture","processing_seconds":round(time.monotonic()-start,2)}
Path("output/03_검증수치.json").write_text(json.dumps({"summary":summary,"frames":measure},ensure_ascii=False,indent=2),encoding="utf-8")
print("RESULT",json.dumps(summary,ensure_ascii=False),flush=True)
assert summary["pose_detection_frames"]>=.6*len(frames)
