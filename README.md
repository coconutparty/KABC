# KABC: 퇴근 후 플레이볼 — Tech Demo 0.0.1

웹 기반 게임 로직 검증용 테크데모입니다.

## 실행

```powershell
python backend/manage.py migrate
python backend/manage.py seed_demo
python backend/manage.py runserver 127.0.0.1:8010
```

다른 터미널:

```powershell
npm.cmd --prefix frontend install
npm.cmd --prefix frontend run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## 구현 범위

- Django 6 + SQLite 모델: 팀, 선수, 시즌 규칙, 경기 기록, 게임 스냅샷
- React + TypeScript + Vite 프론트엔드
- seed 기반 4팀/48명 선수 생성, 상대팀 선수 단위 시뮬레이션
- 2주/8경기 일정 루프, 클릭당 20,000원/김철민 체력 -5 낮 일정, 개인 훈련/휴식, 주말 회식
- 주간 일정 시작 시 전원 체력 100% 회복, 평일 저녁에는 직업별 낮 피로 적용, 주말 오전 경기는 전원 체력 100%
- 수요일 회비/찬조금 정산, 팀 훈련, 선발 라인업 관리, 후보 영입/트레이드 UI
- 7이닝 타석 단위 경기 엔진, 콜드게임, 김철민 타격/투구 개입
- 야구장 다이아몬드 시각화, 타구 방향/비거리 표시, 중계 로그와 판정 로그 분리 출력
- 팀 사기, 유대감, 신뢰도, 공정성, 재정 안정도 정산
