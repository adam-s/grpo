import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app')!;

function route() {
  const hash = window.location.hash;
  if (hash.startsWith('#/pipeline/flow')) {
    import('./pipeline/flow/FlowApp.svelte').then((mod) => {
      target.innerHTML = '';
      mount(mod.default, { target });
    });
  } else if (hash.startsWith('#/pipeline/grid')) {
    import('./pipeline/grid/GridApp.svelte').then((mod) => {
      target.innerHTML = '';
      mount(mod.default, { target });
    });
  } else if (hash.startsWith('#/pipeline/model')) {
    import('./pipeline/ModelView.svelte').then((mod) => {
      target.innerHTML = '';
      mount(mod.default, { target });
    });
  } else if (hash.startsWith('#/pipeline/grpo')) {
    import('./pipeline/GrpoView.svelte').then((mod) => {
      target.innerHTML = '';
      mount(mod.default, { target });
    });
  } else if (hash.startsWith('#/pipeline')) {
    import('./pipeline/PipelineApp.svelte').then((mod) => {
      target.innerHTML = '';
      mount(mod.default, { target });
    });
  } else {
    target.innerHTML = '';
    mount(App, { target });
  }
}

window.addEventListener('hashchange', route);
route();
