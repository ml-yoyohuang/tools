import {works} from './data.js';
import {mount} from '../common/player.js';
import {liquid,elastic,timeMaterial} from './ink.js';
import {paper} from './paper.js';
import {iridescent,glass} from './optics.js';
const id=Number(document.body.dataset.work);
mount(works[id],[liquid,elastic,paper,iridescent,glass,timeMaterial][id]);
