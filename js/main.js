import { setupFitToStage } from './util/fit.js';
import { preventIOSZoom } from './util/ios.js';

preventIOSZoom();

const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');

if (stage) {
  setupFitToStage(stage, viewport);
}
