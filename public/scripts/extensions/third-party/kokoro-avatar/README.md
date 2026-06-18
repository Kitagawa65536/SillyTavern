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
http://localhost:5173/avatar.html
```

## iframe URL設定

SillyTavernの `Kokoro Avatar` 設定で `Avatar iframe URL` を指定します。TTS設定をURL queryで渡す場合は、ここに含めます。

```text
http://localhost:5173/avatar.html?ttsEndpoint=http://127.0.0.1:8088&ttsModel=irodori-tts&voice=calm_girl&responseFormat=wav
```

## TTS設定

SillyTavern側ではTTS API keyを扱いません。`kokoro` の `avatar.html` 側でURL queryまたはlocalStorageに設定してください。

## 既知の制限

- iframeとTTSサーバーのCORS設定はローカル環境に合わせて調整が必要です。
- AI応答のイベントは現在のSillyTavern内の `CHARACTER_MESSAGE_RENDERED` に合わせています。
- 口パクは音量ベースで、厳密な口形素同期ではありません。
- 右下固定表示から始めています。ドラッグ可能ウィンドウ化は後続改修向けです。
