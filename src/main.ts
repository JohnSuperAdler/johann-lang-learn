import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';
import { initPwa, pwa } from './lib/pwa.svelte';

initPwa();
// Service worker 只在 https 或 localhost 生效；用區網 IP 的 http 開啟時不會註冊。
if (import.meta.env.PROD) registerSW({ immediate: true, onOfflineReady() { pwa.offlineReady = true; } });

const app = mount(App, { target: document.getElementById('app')! });

export default app;
