import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

const MODULE_NAME = 'kokoroAvatar';

const defaultSettings = Object.freeze({
    enabled: true,
    avatarUrl: 'http://localhost:5173/avatar.html?ttsEndpoint=http://127.0.0.1:8088&ttsModel=irodori-tts&voice=calm_girl&responseFormat=wav',
    autoSpeak: true,
    stopBeforeSpeak: true,
    width: 360,
    height: 480,
    mouthX: 500,
    mouthY: 520,
    mouthScale: 1,
    skipCodeBlocks: true,
    skipQuotes: false,
});

let avatarFrame = null;
let panel = null;
let statusElement = null;
let lastSpokenMessageId = null;

export async function init() {
    initSettings();
    renderAvatarPanel();
    renderSettings();
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

    avatarFrame = document.createElement('iframe');
    avatarFrame.id = 'kokoro_avatar_frame';
    avatarFrame.title = 'Kokoro Avatar';
    avatarFrame.allow = 'autoplay';
    avatarFrame.addEventListener('load', () => {
        setStatus('Avatar iframe loaded.');
        postMouthConfig();
    });
    avatarFrame.addEventListener('error', () => {
        setStatus('Failed to load avatar iframe.');
    });

    panel.appendChild(avatarFrame);
    document.body.appendChild(panel);
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
        speakText('Kokoro Avatar extension test speech.');
    });
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

function speakText(text) {
    if (!avatarFrame?.contentWindow) {
        setStatus('Avatar iframe is not ready.');
        return;
    }

    if (getSettings().stopBeforeSpeak) {
        stopSpeech();
    }

    avatarFrame.contentWindow.postMessage({
        type: 'kokoro:speak',
        text,
    }, '*');
    setStatus('Sent speak request.');
}

function stopSpeech() {
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
    avatarFrame.src = getSettings().avatarUrl;
    setStatus('Reloading avatar iframe.');
}

function setStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
}
