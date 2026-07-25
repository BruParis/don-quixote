import type { DialogueDef, EpisodeDef, MapDef, MinigameDef } from '../types';

import episodesJson from './episodes.json';

import village from './maps/village.json';
import house from './maps/house.json';
import innExterior from './maps/inn_exterior.json';
import innInterior from './maps/inn_interior.json';
import windmills from './maps/windmills.json';

import sobrina from './dialogues/sobrina.json';
import barbero from './dialogues/barbero.json';
import cura from './dialogues/cura.json';
import ama from './dialogues/ama.json';
import moza from './dialogues/moza.json';
import ventero from './dialogues/ventero.json';
import arriero from './dialogues/arriero.json';
import sancho from './dialogues/sancho.json';
import molino from './dialogues/molino.json';

import mcSaludos from './minigames/mc_saludos.json';
import fibSerEstar from './minigames/fib_ser_estar.json';
import matchCasa from './minigames/match_casa.json';
import mcComida from './minigames/mc_comida.json';
import matchCaballero from './minigames/match_caballero.json';
import conjPresente from './minigames/conj_presente.json';
import fibMolinos from './minigames/fib_molinos.json';

export const EPISODES = episodesJson as EpisodeDef[];

export const MAPS: Record<string, MapDef> = {
  village: village as unknown as MapDef,
  house: house as unknown as MapDef,
  inn_exterior: innExterior as unknown as MapDef,
  inn_interior: innInterior as unknown as MapDef,
  windmills: windmills as unknown as MapDef
};

export const DIALOGUES: Record<string, DialogueDef> = {
  sobrina: sobrina as DialogueDef,
  barbero: barbero as DialogueDef,
  cura: cura as DialogueDef,
  ama: ama as DialogueDef,
  moza: moza as DialogueDef,
  ventero: ventero as DialogueDef,
  arriero: arriero as DialogueDef,
  sancho: sancho as DialogueDef,
  molino: molino as DialogueDef
};

export const MINIGAMES: Record<string, MinigameDef> = Object.fromEntries(
  [mcSaludos, fibSerEstar, matchCasa, mcComida, matchCaballero, conjPresente, fibMolinos].map(
    (m) => [m.id, m as MinigameDef]
  )
);
