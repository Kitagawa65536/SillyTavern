import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

const MODULE_NAME = 'kokoroAvatar';
const DEFAULT_AVATAR_URL = 'http://127.0.0.1:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts-lite&voice=codex_test_calm_girl&responseFormat=wav&characterUrl=/kokoro/models/character.png';
const LEGACY_LOCALHOST_AVATAR_URL = 'http://localhost:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts&voice=codex_test_calm_girl&responseFormat=wav';
const LEGACY_LOCALHOST_AVATAR_URL_127 = 'http://127.0.0.1:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts&voice=codex_test_calm_girl&responseFormat=wav';
const LEGACY_IRODORI_TTS_AVATAR_URL = 'http://127.0.0.1:5173/kokoro/avatar.html?ttsEndpoint=/irodori-tts&ttsModel=irodori-tts&voice=codex_test_calm_girl&responseFormat=wav&characterUrl=/kokoro/models/character.png';

const defaultSettings = Object.freeze({
    enabled: true,
    avatarUrl: DEFAULT_AVATAR_URL,
    autoSpeak: true,
    stopBeforeSpeak: true,
    width: 360,
    height: 480,
    mouthX: 1152,
    mouthY: 1385,
    mouthScale: 1,
    skipCodeBlocks: true,
    skipQuotes: false,
});

let avatarFrame = null;
let panel = null;
let statusElement = null;
let panelStatusElement = null;
let lastSpokenMessageId = null;
let lastSpeechText = '';
let avatarReady = false;
let pendingSpeechText = null;

export async function init() {
    initSettings();
    renderAvatarPanel();
    renderSettings();
    bindAvatarMessages();
    bindChatEvents();
    applyPanelSettings();
}

function initSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    if (
        extension_settings[MODULE_NAME].avatarUrl === LEGACY_LOCALHOST_AVATAR_URL ||
        extension_settings[MODULE_NAME].avatarUrl === LEGACY_LOCALHOST_AVATAR_URL_127 ||
        extension_settings[MODULE_NAME].avatarUrl === LEGACY_IRODORI_TTS_AVATAR_URL
    ) {
        extension_settings[MODULE_NAME].avatarUrl = DEFAULT_AVATAR_URL;
        saveSettingsDebounced();
    }

    if (extension_settings[MODULE_NAME].mouthX === 500 && extension_settings[MODULE_NAME].mouthY === 520) {
        extension_settings[MODULE_NAME].mouthX = defaultSettings.mouthX;
        extension_settings[MODULE_NAME].mouthY = defaultSettings.mouthY;
        saveSettingsDebounced();
    }
}

function getSettings() {
    return extension_settings[MODULE_NAME];
}

function saveSetting(key, value) {
    getSettings()[key] = value;
    saveSettingsDebounced();
    applyPanelSettings();
}

function renderAvatarPanel() {
    if (document.getElementById('kokoro_avatar_panel')) {
        return;
    }

    panel = document.createElement('div');
    panel.id = 'kokoro_avatar_panel';

    const toolbar = document.createElement('div');
    toolbar.id = 'kokoro_avatar_toolbar';
    toolbar.innerHTML = `
        <span class="kokoro-avatar-title">Kokoro Avatar</span>
        <span id="kokoro_avatar_panel_status">Loading...</span>
        <input id="kokoro_avatar_panel_test" class="menu_button" type="button" value="Test">
        <input id="kokoro_avatar_panel_replay" class="menu_button" type="button" value="Replay">
        <input id="kokoro_avatar_panel_stop" class="menu_button" type="button" value="Stop">
        <input id="kokoro_avatar_panel_reload" class="menu_button" type="button" value="Reload">
    `;
    panelStatusElement = toolbar.querySelector('#kokoro_avatar_panel_status');

    avatarFrame = document.createElement('iframe');
    avatarFrame.id = 'kokoro_avatar_frame';
    avatarFrame.title = 'Kokoro Avatar';
    avatarFrame.allow = 'autoplay';
    avatarFrame.addEventListener('load', () => {
        avatarReady = false;
        setStatus('Avatar iframe loaded.');
    });
    avatarFrame.addEventListener('error', () => {
        setStatus('Failed to load avatar iframe.');
    });

    panel.appendChild(toolbar);
    panel.appendChild(avatarFrame);
    document.body.appendChild(panel);

    toolbar.querySelector('#kokoro_avatar_panel_test')?.addEventListener('click', () => {
        speakText('Kokoro Avatar extension test speech.', { remember: false });
    });
    toolbar.querySelector('#kokoro_avatar_panel_replay')?.addEventListener('click', replayLastSpeechText);
    toolbar.querySelector('#kokoro_avatar_panel_stop')?.addEventListener('click', stopSpeech);
    toolbar.querySelector('#kokoro_avatar_panel_reload')?.addEventListener('click', reloadFrame);
}

function bindAvatarMessages() {
    window.addEventListener('message', (event) => {
        if (!avatarFrame?.contentWindow || event.source !== avatarFrame.contentWindow) {
            return;
        }

        const data = event.data;
        if (!data || data.type !== 'kokoro:status' || typeof data.status !== 'string') {
            return;
        }

        setStatus(`Avatar: ${data.status}`);
        if (data.status === 'Ready' || data.status === 'Voice enabled') {
            avatarReady = true;
            postMouthConfig();
            flushPendingSpeech();
        }
    });
}

function renderSettings() {
    if (document.getElementById('kokoro_avatar_settings')) {
        return;
    }

    const container = document.createElement('div');
    container.id = 'kokoro_avatar_settings';
    container.classList.add('extension_container');
    container.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Kokoro Avatar</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="kokoro-avatar-settings-grid">
                    ${checkboxRow('kokoro_avatar_enabled', 'Enable')}
                    ${checkboxRow('kokoro_avatar_auto_speak', 'Auto speak on AI response')}
                    ${checkboxRow('kokoro_avatar_stop_before_speak', 'Stop current speech before new speech')}
                    ${checkboxRow('kokoro_avatar_skip_codeblocks', 'Skip code blocks')}
                    ${checkboxRow('kokoro_avatar_skip_quotes', 'Skip markdown quotes')}
                    ${inputRow('kokoro_avatar_url', 'Avatar iframe URL', 'text')}
                    ${inputRow('kokoro_avatar_width', 'Iframe width', 'number')}
                    ${inputRow('kokoro_avatar_height', 'Iframe height', 'number')}
                    ${inputRow('kokoro_avatar_mouth_x', 'Mouth x', 'number')}
                    ${inputRow('kokoro_avatar_mouth_y', 'Mouth y', 'number')}
                    ${inputRow('kokoro_avatar_mouth_scale', 'Mouth scale', 'number', '0.1')}
                    <div id="kokoro_avatar_status" class="neutral_warning"></div>
                    <div class="kokoro-avatar-buttons">
                        <input id="kokoro_avatar_test_speak" class="menu_button" type="button" value="Test Speak">
                        <input id="kokoro_avatar_replay" class="menu_button" type="button" value="Replay Last">
                        <input id="kokoro_avatar_stop" class="menu_button" type="button" value="Stop">
                        <input id="kokoro_avatar_reload" class="menu_button" type="button" value="Reload iframe">
                    </div>
                </div>
            </div>
        </div>`;

    const settingsRoot = document.getElementById('extensions_settings2')
        || document.getElementById('extensions_settings')
        || document.body;
    settingsRoot.appendChild(container);

    statusElement = document.getElementById('kokoro_avatar_status');
    bindSettingsInputs();
    loadSettingsToInputs();
}

function checkboxRow(id, label) {
    return `
        <label class="checkbox_label" for="${id}">
            <input type="checkbox" id="${id}">
            <small>${label}</small>
        </label>`;
}

function inputRow(id, label, type, step = '1') {
    return `
        <label class="kokoro-avatar-settings-row" for="${id}">
            <span>${label}</span>
            <input id="${id}" class="text_pole" type="${type}" step="${step}">
        </label>`;
}

function bindSettingsInputs() {
    const bindings = [
        ['kokoro_avatar_enabled', 'enabled', 'checked'],
        ['kokoro_avatar_auto_speak', 'autoSpeak', 'checked'],
        ['kokoro_avatar_stop_before_speak', 'stopBeforeSpeak', 'checked'],
        ['kokoro_avatar_skip_codeblocks', 'skipCodeBlocks', 'checked'],
        ['kokoro_avatar_skip_quotes', 'skipQuotes', 'checked'],
        ['kokoro_avatar_url', 'avatarUrl', 'value'],
        ['kokoro_avatar_width', 'width', 'number'],
        ['kokoro_avatar_height', 'height', 'number'],
        ['kokoro_avatar_mouth_x', 'mouthX', 'number'],
        ['kokoro_avatar_mouth_y', 'mouthY', 'number'],
        ['kokoro_avatar_mouth_scale', 'mouthScale', 'number'],
    ];

    for (const [id, key, mode] of bindings) {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) continue;

        input.addEventListener('input', () => {
            if (mode === 'checked') {
                saveSetting(key, input.checked);
            } else if (mode === 'number') {
                saveSetting(key, Number(input.value));
            } else {
                saveSetting(key, input.value);
            }
        });
    }

    document.getElementById('kokoro_avatar_test_speak')?.addEventListener('click', () => {
        speakText('Kokoro Avatar extension test speech.', { remember: false });
    });
    document.getElementById('kokoro_avatar_replay')?.addEventListener('click', replayLastSpeechText);
    document.getElementById('kokoro_avatar_stop')?.addEventListener('click', stopSpeech);
    document.getElementById('kokoro_avatar_reload')?.addEventListener('click', reloadFrame);
}

function loadSettingsToInputs() {
    const settings = getSettings();
    setChecked('kokoro_avatar_enabled', settings.enabled);
    setChecked('kokoro_avatar_auto_speak', settings.autoSpeak);
    setChecked('kokoro_avatar_stop_before_speak', settings.stopBeforeSpeak);
    setChecked('kokoro_avatar_skip_codeblocks', settings.skipCodeBlocks);
    setChecked('kokoro_avatar_skip_quotes', settings.skipQuotes);
    setValue('kokoro_avatar_url', settings.avatarUrl);
    setValue('kokoro_avatar_width', settings.width);
    setValue('kokoro_avatar_height', settings.height);
    setValue('kokoro_avatar_mouth_x', settings.mouthX);
    setValue('kokoro_avatar_mouth_y', settings.mouthY);
    setValue('kokoro_avatar_mouth_scale', settings.mouthScale);
}

function setChecked(id, value) {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
        input.checked = Boolean(value);
    }
}

function setValue(id, value) {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
        input.value = String(value);
    }
}

function applyPanelSettings() {
    const settings = getSettings();
    if (!panel || !avatarFrame) return;

    panel.classList.toggle('kokoro-avatar-hidden', !settings.enabled);
    panel.style.width = `${clampNumber(settings.width, 160, 1200)}px`;
    panel.style.height = `${clampNumber(settings.height, 160, 1200)}px`;
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.maxHeight = 'calc(100vh - 24px)';

    if (avatarFrame.src !== settings.avatarUrl) {
        avatarFrame.src = settings.avatarUrl;
    }

    postMouthConfig();
}

function bindChatEvents() {
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        onAssistantMessage(messageId);
    });
}

function onAssistantMessage(messageId) {
    const settings = getSettings();
    if (!settings.enabled || !settings.autoSpeak) return;
    if (lastSpokenMessageId === messageId) return;

    const context = SillyTavern.getContext();
    const message = context.chat?.[messageId];
    if (!message || message.is_user || message.is_system) return;

    const text = cleanMessageText(String(message.mes ?? ''), settings);
    if (!text) return;

    lastSpokenMessageId = messageId;
    speakText(text);
}

function cleanMessageText(text, settings) {
    let result = text;

    if (settings.skipCodeBlocks) {
        result = result.replace(/```[\s\S]*?```/g, ' ');
        result = result.replace(/`[^`]*`/g, ' ');
    }

    if (settings.skipQuotes) {
        result = result.replace(/^\s*>.*$/gm, ' ');
    }

    result = stripHtml(result);
    result = result
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ''))
        .replace(/[*_~#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return result;
}

function stripHtml(text) {
    const element = document.createElement('div');
    element.innerHTML = text;
    return element.textContent || element.innerText || '';
}

function speakText(text, options = {}) {
    const input = String(text ?? '').trim();
    if (!input) {
        setStatus('No speech text to send.');
        return;
    }

    if (options.remember !== false) {
        lastSpeechText = input;
    }

    if (!avatarFrame?.contentWindow) {
        setStatus('Avatar iframe is not ready.');
        return;
    }

    if (!avatarReady) {
        pendingSpeechText = input;
        setStatus('Avatar is starting; queued speak request.');
        return;
    }

    if (getSettings().stopBeforeSpeak) {
        stopSpeech();
    }

    avatarFrame.contentWindow.postMessage({
        type: 'kokoro:speak',
        text: input,
    }, '*');
    setStatus(options.replay ? 'Sent replay request.' : 'Sent speak request.');
}

function replayLastSpeechText() {
    if (!lastSpeechText) {
        setStatus('No recent message to replay.');
        return;
    }

    speakText(lastSpeechText, { remember: false, replay: true });
}

function stopSpeech() {
    pendingSpeechText = null;
    avatarFrame?.contentWindow?.postMessage({ type: 'kokoro:stop' }, '*');
    setStatus('Sent stop request.');
}

function postMouthConfig() {
    if (!avatarFrame?.contentWindow) return;

    const settings = getSettings();
    avatarFrame.contentWindow.postMessage({
        type: 'kokoro:setMouthConfig',
        config: {
            x: Number(settings.mouthX),
            y: Number(settings.mouthY),
            scale: Number(settings.mouthScale),
        },
    }, '*');
}

function reloadFrame() {
    if (!avatarFrame) return;
    avatarReady = false;
    pendingSpeechText = null;
    avatarFrame.src = getSettings().avatarUrl;
    setStatus('Reloading avatar iframe.');
}

function flushPendingSpeech() {
    if (!pendingSpeechText) {
        return;
    }

    const text = pendingSpeechText;
    pendingSpeechText = null;
    speakText(text, { remember: false });
}

function setStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
    if (panelStatusElement) {
        panelStatusElement.textContent = message;
    }
}

function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
}
