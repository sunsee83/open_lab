# 3번 AI 자동 분석 3D 프리비즈 — 2026-11-01 초기 통합 검증
## 원본 보호
- 대상 플러그인 video-previs 1.0.0의 WAN 및 Blender 3-덩어리 경로를 변경하지 않음
- 플러그인 1.0.1에서 별도 auto3/ 폴더 3파일 추가. 기존 제작 규칙 그대로 보존
- main 브랜치에는 변경 없음; 이 브랜치는 실험용
## 입력과 자동 분석
- 1인 전신 동작 데이터: Pexels 6003772, MediaPipe 3D 관절 48프레임
- 팬·줌·3초 하드컷은 원본에서 실제 촬영된 것이 아니라 **검증용으로 디지털 합성**
- 48/48 사람 자세 연결, 46/48 배경 움직임 추정 유효, 컷 시점 3.000초 검출
- 합성 줌 기준 평균 절대 오차 0.00083, 프레임간 팬 이동량 중앙 절대 오차 1.177픽셀
## 실제 3D 제작
- Blender 액션에서 3D 메시/관절 키프레임 및 움직이는 2개 카메라 생성
- Blender 직교 카메라 영상비 보정 및 발 지지면 보정 후 실제 정면/사선 MP4 생성
- 납품 MP4: H.264, 640×1080, 8fps, 48프레임, 6.0초
- 편집가능 Blender 파일 저장됨
## 결과
- 성공 실행: https://github.com/sunsee83/open_lab/actions/runs/41226161639
- 직접 열기: https://github.com/sunsee83/open_lab/releases/tag/previs-auto3-development-20261101
- 모바일 MP4: https://github.com/sunsee83/open_lab/releases/download/previs-auto3-development-20261101/auto3_mobile_comparison.mp4
## 유의
- 실제 촬영 카메라의 물리적 경로나 복수 인물, 소품/세트 깊이의 자동 복원은 아직 검증되지 않음
- Blender 회색 세트는 정확한 실내 3D 복원이 아닌 검증용 프록시
- 앞뒤 깊이, 발 접지, 모델 방향 오차에 대한 더 강한 평가가 필요
