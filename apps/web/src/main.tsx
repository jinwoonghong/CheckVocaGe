import { h, render } from 'preact';

function App() {
  return h('div', null, 'WebVoca Web Placeholder');
}

const container = document.getElementById('root');
if (container) {
  render(h(App, {}), container);
}
