# BeepBeepDesktop

`BeepBeepDesktop`은 공부용 카드 데이터를 작은 데스크톱 위젯 형태로 띄워두고, 정해진 시간 간격에 맞춰 다음 카드로 넘기면서 반복 학습할 수 있게 만든 Electron 기반 앱입니다.

현재 버전: `v1.1`

## 주요 기능

- Google Sheets의 카드 데이터를 읽어와서 바로 학습 카드로 표시
- 작은 데스크톱 위젯 형태로 띄워두고 공부 가능
- `Auto` 타이머로 일정 시간마다 다음 카드 자동 전환
- `이전 카드 / 다음 카드` 수동 이동
- 카드 전환 비프음 `Beep` 토글
- 우클릭 메뉴에서 위젯 크기 변경
  - `작게`
  - `중간`
  - `크게`
- 우클릭 메뉴에서 투명도 변경
  - `100%`
  - `85%`
  - `70%`
  - `55%`
- 우클릭 메뉴에서
  - `항상 위에`
  - `작업표시줄에서 숨기기`
  설정 가능

## 데이터 구조

앱은 현재 공개 Google Sheets를 카드 데이터 소스로 사용합니다.

기본 컬럼:

- `category`
- `question`
- `definition`
- `keywords`

앱 시작 시 Google Sheets를 한 번 읽어서 카드 배열을 구성하고, 이후에는 그 메모리 데이터를 기준으로 카드가 순환됩니다.

## 실행 방법

의존성 설치:

```powershell
npm install
```

데스크톱 위젯 실행:

```powershell
npm run desktop
```

개발 모드 실행:

```powershell
npm run desktop:dev
```

휴대용 exe 패키징:

```powershell
npm run desktop:package
```

패키징 결과물은 아래 폴더에 생성됩니다.

```text
dist-portable/BeepBeepBeep Widget-win32-x64/
```

## 파일 구성

- `index.html`: 앱 화면 구조
- `styles.css`: 웹/위젯 공통 스타일
- `app.js`: 카드 로딩, 타이머, UI 동작
- `electron-main.js`: 데스크톱 창 생성 및 우클릭 메뉴
- `electron-preload.js`: Electron 브리지

## 사용 방법

1. 앱을 실행합니다.
2. 카드를 읽어보며 내용을 확인합니다.
3. `Auto`를 켜면 설정된 시간마다 다음 카드로 넘어갑니다.
4. 필요하면 `이전 카드 / 다음 카드`로 수동 이동합니다.
5. `Beep` 버튼으로 카드 전환음을 켜고 끌 수 있습니다.
6. 우클릭 메뉴에서 크기와 투명도를 상황에 맞게 조절합니다.

## 참고

- `dist`, `dist-portable`, `node_modules`는 Git에 올리지 않도록 `.gitignore`에 제외되어 있습니다.
- 위젯은 Windows 환경 기준으로 사용하도록 맞춰져 있습니다.
