# Kokoro Avatar Extension

SillyTavern のチャット応答を `kokoro/avatar.html` に `postMessage` で送り、iframe内のAvatarに読み上げと口パクをさせるローカル用UI Extensionです。

## インストール場所

このフォルダを以下に置きます。

```text
SillyTavern/public/scripts/extensions/third-party/kokoro-avatar
```

## 有効化方法

SillyTavernを起動し、Extensionsのthird-party extension一覧から `Kokoro Avatar` を有効化します。設定パネルに `Kokoro Avatar` が追加されます。

## kokoro側の起動

別ターミナルで `kokoro` リポジトリを起動します。

```powershell
cd ..\kokoro
npm install
npm run dev
```

既定のiframe URLは以下です。

```text
http://127.0.0.1:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts&voice=codex_test_calm_girl&responseFormat=wav&characterUrl=/kokoro/models/character.png
```

## iframe URL設定

SillyTavernの `Kokoro Avatar` 設定で `Avatar iframe URL` を指定します。TTS設定をURL queryで渡す場合は、ここに含めます。

```text
http://127.0.0.1:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts&voice=codex_test_calm_girl&responseFormat=wav&characterUrl=/kokoro/models/character.png
```

## TTS設定

SillyTavern側ではTTS API keyを扱いません。`kokoro` の `avatar.html` 側でURL queryまたはlocalStorageに設定してください。

## 音声再生の許可

ブラウザのautoplay制限により、初回はiframe内の `Enable Voice` をクリックする必要があります。TTS生成後に再生だけが拒否された場合、avatar側に `Play Last Speech` が表示され、生成済み音声を再利用して再生できます。

右下のKokoro Avatar小窓には常時表示の操作バーがあります。`Test` / `Replay` / `Stop` / `Reload` は、Extensions設定パネルを開かなくてもその場で確認できます。

`Replay` は、SillyTavern側で最後に検出したAI応答本文をもう一度 `kokoro:speak` として送ります。ストリーミングや再生タイミングの問題で読み上げが聞こえなかった場合は、ChatUI上の直近応答が表示された後に `Replay` を押してください。

## 口パク差分

既定では `kokoro/public/models/character.png` を表示します。口パク用に以下の透明PNGを追加すると、生成フォールバックではなく画像に合った口差分で表示できます。

```text
kokoro/public/mouth/closed.png
kokoro/public/mouth/half.png
kokoro/public/mouth/open.png
```

添付キャラ画像向けの初期口中心は、元画像 `2304x3072` の座標でおおよそ `x=1152`, `y=1385` です。`320x180` 程度の透明キャンバス中央に口だけを描いた差分から始めると調整しやすいです。

## 既知の制限

- iframeとTTSサーバーのCORS設定はローカル環境に合わせて調整が必要です。
- AI応答のイベントは現在のSillyTavern内の `CHARACTER_MESSAGE_RENDERED` に合わせています。
- 口パクは音量ベースで、厳密な口形素同期ではありません。
- 右下固定表示から始めています。ドラッグ可能ウィンドウ化は後続改修向けです。
