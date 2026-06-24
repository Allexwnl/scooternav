<script setup lang="ts">
import { settings } from '../stores/settings'
import { t } from '../services/i18n'
import type { ReportType } from '../services/reports'

const emit = defineEmits<{ close: [] }>()

const REPORT_TYPES: { type: ReportType; emoji: string; key: string }[] = [
  { type: 'politie', emoji: '🚓', key: 'rt_politie' },
  { type: 'rollerbank', emoji: '⚙️', key: 'rt_rollerbank' },
  { type: 'hulpdienst', emoji: '🚑', key: 'rt_hulpdienst' },
  { type: 'gevaarlijk_wegdek', emoji: '⚠️', key: 'rt_gevaarlijk_wegdek' },
  { type: 'wegafsluiting', emoji: '🚧', key: 'rt_wegafsluiting' },
]

function shown(tp: ReportType) {
  return !settings.hiddenTypes.includes(tp)
}
function toggleType(tp: ReportType) {
  const i = settings.hiddenTypes.indexOf(tp)
  if (i >= 0) settings.hiddenTypes.splice(i, 1)
  else settings.hiddenTypes.push(tp)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="head">
        <strong>{{ t('settings') }}</strong>
        <button class="x" aria-label="X" @click="emit('close')">✕</button>
      </div>

      <section>
        <h4>{{ t('theme') }}</h4>
        <div class="seg">
          <button :class="{ active: settings.theme === 'licht' }" @click="settings.theme = 'licht'">
            {{ t('light') }}
          </button>
          <button :class="{ active: settings.theme === 'donker' }" @click="settings.theme = 'donker'">
            {{ t('dark') }}
          </button>
        </div>
      </section>

      <section>
        <h4>{{ t('language') }}</h4>
        <div class="seg">
          <button :class="{ active: settings.locale === 'nl' }" @click="settings.locale = 'nl'">🇳🇱 Nederlands</button>
          <button :class="{ active: settings.locale === 'en' }" @click="settings.locale = 'en'">🇬🇧 English</button>
        </div>
      </section>

      <section>
        <h4>{{ t('default_plate') }}</h4>
        <div class="seg">
          <button :class="{ active: settings.plate === 'blauw' }" @click="settings.plate = 'blauw'">
            {{ t('plate_blue') }}
          </button>
          <button :class="{ active: settings.plate === 'geel' }" @click="settings.plate = 'geel'">
            {{ t('plate_yellow') }}
          </button>
        </div>
      </section>

      <section>
        <h4>{{ t('voice_nav') }}</h4>
        <div class="seg">
          <button :class="{ active: settings.voice }" @click="settings.voice = true">{{ t('on') }}</button>
          <button :class="{ active: !settings.voice }" @click="settings.voice = false">{{ t('off') }}</button>
        </div>
      </section>

      <section>
        <h4>{{ t('keep_awake') }}</h4>
        <div class="seg">
          <button :class="{ active: settings.keepAwake }" @click="settings.keepAwake = true">{{ t('on') }}</button>
          <button :class="{ active: !settings.keepAwake }" @click="settings.keepAwake = false">{{ t('off') }}</button>
        </div>
      </section>

      <section>
        <h4>{{ t('show_reports') }}</h4>
        <div class="checks">
          <label v-for="rt in REPORT_TYPES" :key="rt.type">
            <input type="checkbox" :checked="shown(rt.type)" @change="toggleType(rt.type)" />
            <span>{{ rt.emoji }} {{ t(rt.key) }}</span>
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.sheet {
  width: min(360px, 90vw);
  height: 100%;
  background: var(--surface);
  color: var(--text);
  padding: 16px;
  overflow-y: auto;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.x {
  border: 0;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
}
section {
  margin-bottom: 18px;
}
h4 {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.seg {
  display: flex;
  gap: 8px;
}
.seg button {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  cursor: pointer;
}
.seg button.active {
  border-color: var(--accent);
  background: var(--surface-2);
  color: var(--accent);
  font-weight: 600;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.checks label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
</style>
