// Уся симуляція рахує в цілих «підпікселях»: 1 піксель = 256 одиниць.
// Цілі числа дають однаковий результат на будь-якому комп'ютері — на цьому тримається онлайн.
export const SUB = 256;
export const TICKS_PER_SECOND = 60;

export const TILE = 40 * SUB;
export const CHAR_W = 26 * SUB;
export const CHAR_H = 34 * SUB;

export const GRAV = 141; // 0,55 пікселя за тік²
export const GRAV_SHORT_JUMP = 127; // додаткова гравітація, коли стрибок відпустили раніше
export const MAX_FALL = 12 * SUB;
export const RUN_SPEED = 1075; // 4,2 пікселя за тік
export const ACC_GROUND = 205;
export const ACC_AIR = 128;
export const JUMP_SPEED = 2765; // 10,8 пікселя за тік
export const LINK_BOOST_NUM = 13; // стрибок удвох: ×1,3
export const LINK_BOOST_DEN = 10;
export const COYOTE_TICKS = 6; // ще можна стрибнути, щойно зійшовши з краю
export const JUMP_BUFFER_TICKS = 7; // натискання трохи раніше за приземлення не губиться

export const POOL_INSET = 14 * SUB; // наскільки басейн нижчий за підлогу
export const HAZARD_DEPTH = 10 * SUB; // занурення, з якого рідина вже діє
export const STEP_UP = 16 * SUB;
export const ONE_WAY_H = 12 * SUB;
export const DEATH_TICKS = 70;

export const LINK_NEAR_X = 60 * SUB;
export const LINK_NEAR_Y = 16 * SUB;
export const LINK_BREAK = 90 * SUB;

export const GATE_W = 22 * SUB;
export const GATE_OPEN_STEP = 40; // відчиненість 0…1000 за тік
export const GATE_CLOSE_STEP = 90;
export const PLATE_MIN_OVERLAP = 6 * SUB;

export const LILY_W = 44 * SUB;
export const LILY_H = 8 * SUB;
export const LILY_SINK = 3 * SUB;

export const LEVER_REACH = 12 * SUB; // важіль перемикається, коли середина героя ближче
export const LIFT_H = 12 * SUB;
export const LIFT_SPEED = 2 * SUB; // за тік
export const PULLEY_H = 12 * SUB;
export const PULLEY_STEP = 8; // хід противаги 0…1000 за тік: повний — приблизно 2 с
export const GONDOLA_H = 10 * SUB;
export const GONDOLA_DECK = 8 * SUB; // палуба над водою

export const ITEM_RADIUS = 24 * SUB;
export const DOOR_REACH = 14 * SUB;

// Біти введення одного гравця
export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;
export const IN_LINK = 8;
