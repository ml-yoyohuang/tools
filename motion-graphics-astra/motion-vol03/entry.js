import {mount} from '../common/player.js';
import {works} from './data.js';
import {analog,halftone,chromatic} from './print-and-colour.js';
import {impossible,negative} from './space.js';
import {soundArchitecture} from './score.js';
const index=Number(document.body.dataset.work);
mount(works[index],[analog,impossible,halftone,soundArchitecture,chromatic,negative][index]);
