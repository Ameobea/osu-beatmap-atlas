// # Copyright 2019 Google LLC.
// # SPDX-License-Identifier: Apache-2.0
//
// # Author: Anton Mikhailov
//
// Taken from: https://gist.github.com/mikhailov-work/ee72ba4191942acecc03fe6da94fc73f
//
// And modified to look better on dark backgrounds at high values

import { clamp } from '../util';

// prettier-ignore
const pre = ([[0.18995,0.07176,0.23217],[0.19483,0.08339,0.26149],[0.19956,0.09498,0.29024],[0.20415,0.10652,0.31844],[0.20860,0.11802,0.34607],[0.21291,0.12947,0.37314],[0.21708,0.14087,0.39964],[0.22111,0.15223,0.42558],[0.22500,0.16354,0.45096],[0.22875,0.17481,0.47578],[0.23236,0.18603,0.50004],[0.23582,0.19720,0.52373],[0.23915,0.20833,0.54686],[0.24234,0.21941,0.56942],[0.24539,0.23044,0.59142],] as [number, number, number][]);

const mapPre = (val: number, i: number) => clamp(val * (1 + ((pre.length - i) / pre.length) * 0.6), 0, 1);

const mappedPre = pre.map(([r, g, b], i) => [mapPre(r, i), mapPre(g, i), mapPre(b, i)] as [number, number, number]);

// prettier-ignore
const TurboColormapLUT: [number, number, number][] = [...mappedPre,
[0.24830,0.24143,0.61286],[0.25107,0.25237,0.63374],[0.25369,0.26327,0.65406],[0.25618,0.27412,0.67381],[0.25853,0.28492,0.69300],[0.26074,0.29568,0.71162],[0.26280,0.30639,0.72968],[0.26473,0.31706,0.74718],[0.26652,0.32768,0.76412],[0.26816,0.33825,0.78050],[0.26967,0.34878,0.79631],[0.27103,0.35926,0.81156],[0.27226,0.36970,0.82624],[0.27334,0.38008,0.84037],[0.27429,0.39043,0.85393],[0.27509,0.40072,0.86692],[0.27576,0.41097,0.87936],[0.27628,0.42118,0.89123],[0.27667,0.43134,0.90254],[0.27691,0.44145,0.91328],[0.27701,0.45152,0.92347],[0.27698,0.46153,0.93309],[0.27680,0.47151,0.94214],[0.27648,0.48144,0.95064],[0.27603,0.49132,0.95857],[0.27543,0.50115,0.96594],[0.27469,0.51094,0.97275],[0.27381,0.52069,0.97899],[0.27273,0.53040,0.98461],[0.27106,0.54015,0.98930],[0.26878,0.54995,0.99303],[0.26592,0.55979,0.99583],[0.26252,0.56967,0.99773],[0.25862,0.57958,0.99876],[0.25425,0.58950,0.99896],[0.24946,0.59943,0.99835],[0.24427,0.60937,0.99697],[0.23874,0.61931,0.99485],[0.23288,0.62923,0.99202],[0.22676,0.63913,0.98851],[0.22039,0.64901,0.98436],[0.21382,0.65886,0.97959],[0.20708,0.66866,0.97423],[0.20021,0.67842,0.96833],[0.19326,0.68812,0.96190],[0.18625,0.69775,0.95498],[0.17923,0.70732,0.94761],[0.17223,0.71680,0.93981],[0.16529,0.72620,0.93161],[0.15844,0.73551,0.92305],[0.15173,0.74472,0.91416],[0.14519,0.75381,0.90496],[0.13886,0.76279,0.89550],[0.13278,0.77165,0.88580],[0.12698,0.78037,0.87590],[0.12151,0.78896,0.86581],[0.11639,0.79740,0.85559],[0.11167,0.80569,0.84525],[0.10738,0.81381,0.83484],[0.10357,0.82177,0.82437],[0.10026,0.82955,0.81389],[0.09750,0.83714,0.80342],[0.09532,0.84455,0.79299],[0.09377,0.85175,0.78264],[0.09287,0.85875,0.77240],[0.09267,0.86554,0.76230],[0.09320,0.87211,0.75237],[0.09451,0.87844,0.74265],[0.09662,0.88454,0.73316],[0.09958,0.89040,0.72393],[0.10342,0.89600,0.71500],[0.10815,0.90142,0.70599],[0.11374,0.90673,0.69651],[0.12014,0.91193,0.68660],[0.12733,0.91701,0.67627],[0.13526,0.92197,0.66556],[0.14391,0.92680,0.65448],[0.15323,0.93151,0.64308],[0.16319,0.93609,0.63137],[0.17377,0.94053,0.61938],[0.18491,0.94484,0.60713],[0.19659,0.94901,0.59466],[0.20877,0.95304,0.58199],[0.22142,0.95692,0.56914],[0.23449,0.96065,0.55614],[0.24797,0.96423,0.54303],[0.26180,0.96765,0.52981],[0.27597,0.97092,0.51653],[0.29042,0.97403,0.50321],[0.30513,0.97697,0.48987],[0.32006,0.97974,0.47654],[0.33517,0.98234,0.46325],[0.35043,0.98477,0.45002],[0.36581,0.98702,0.43688],[0.38127,0.98909,0.42386],[0.39678,0.99098,0.41098],[0.41229,0.99268,0.39826],[0.42778,0.99419,0.38575],[0.44321,0.99551,0.37345],[0.45854,0.99663,0.36140],[0.47375,0.99755,0.34963],[0.48879,0.99828,0.33816],[0.50362,0.99879,0.32701],[0.51822,0.99910,0.31622],[0.53255,0.99919,0.30581],[0.54658,0.99907,0.29581],[0.56026,0.99873,0.28623],[0.57357,0.99817,0.27712],[0.58646,0.99739,0.26849],[0.59891,0.99638,0.26038],[0.61088,0.99514,0.25280],[0.62233,0.99366,0.24579],[0.63323,0.99195,0.23937],[0.64362,0.98999,0.23356],[0.65394,0.98775,0.22835],[0.66428,0.98524,0.22370],[0.67462,0.98246,0.21960],[0.68494,0.97941,0.21602],[0.69525,0.97610,0.21294],[0.70553,0.97255,0.21032],[0.71577,0.96875,0.20815],[0.72596,0.96470,0.20640],[0.73610,0.96043,0.20504],[0.74617,0.95593,0.20406],[0.75617,0.95121,0.20343],[0.76608,0.94627,0.20311],[0.77591,0.94113,0.20310],[0.78563,0.93579,0.20336],[0.79524,0.93025,0.20386],[0.80473,0.92452,0.20459],[0.81410,0.91861,0.20552],[0.82333,0.91253,0.20663],[0.83241,0.90627,0.20788],[0.84133,0.89986,0.20926],[0.85010,0.89328,0.21074],[0.85868,0.88655,0.21230],[0.86709,0.87968,0.21391],[0.87530,0.87267,0.21555],[0.88331,0.86553,0.21719],[0.89112,0.85826,0.21880],[0.89870,0.85087,0.22038],[0.90605,0.84337,0.22188],[0.91317,0.83576,0.22328],[0.92004,0.82806,0.22456],[0.92666,0.82025,0.22570],[0.93301,0.81236,0.22667],[0.93909,0.80439,0.22744],[0.94489,0.79634,0.22800],[0.95039,0.78823,0.22831],[0.95560,0.78005,0.22836],[0.96049,0.77181,0.22811],[0.96507,0.76352,0.22754],[0.96931,0.75519,0.22663],[0.97323,0.74682,0.22536],[0.97679,0.73842,0.22369],[0.98000,0.73000,0.22161],[0.98289,0.72140,0.21918],[0.98549,0.71250,0.21650],[0.98781,0.70330,0.21358],[0.98986,0.69382,0.21043],[0.99163,0.68408,0.20706],[0.99314,0.67408,0.20348],[0.99438,0.66386,0.19971],[0.99535,0.65341,0.19577],[0.99607,0.64277,0.19165],[0.99654,0.63193,0.18738],[0.99675,0.62093,0.18297],[0.99672,0.60977,0.17842],[0.99644,0.59846,0.17376],[0.99593,0.58703,0.16899],[0.99517,0.57549,0.16412],[0.99419,0.56386,0.15918],[0.99297,0.55214,0.15417],[0.99153,0.54036,0.14910],[0.98987,0.52854,0.14398],[0.98799,0.51667,0.13883],[0.98590,0.50479,0.13367],[0.98360,0.49291,0.12849],[0.98108,0.48104,0.12332],[0.97837,0.46920,0.11817],[0.97545,0.45740,0.11305],[0.97234,0.44565,0.10797],[0.96904,0.43399,0.10294],[0.96555,0.42241,0.09798],[0.96187,0.41093,0.09310],[0.95801,0.39958,0.08831],[0.95398,0.38836,0.08362],[0.94977,0.37729,0.07905],[0.94538,0.36638,0.07461],[0.94084,0.35566,0.07031],[0.93612,0.34513,0.06616],[0.93125,0.33482,0.06218],[0.92623,0.32473,0.05837],[0.92105,0.31489,0.05475],[0.91572,0.30530,0.05134],[0.91024,0.29599,0.04814],[0.90463,0.28696,0.04516],[0.89888,0.27824,0.04243],[0.89298,0.26981,0.03993],[0.88691,0.26152,0.03753],[0.88066,0.25334,0.03521],[0.87422,0.24526,0.03297],[0.86760,0.23730,0.03082],[0.86079,0.22945,0.02875],[0.85380,0.22170,0.02677],[0.84662,0.21407,0.02487],[0.83926,0.20654,0.02305],[0.83172,0.19912,0.02131],[0.82399,0.19182,0.01966],[0.81608,0.18462,0.01809],[0.80799,0.17753,0.01660],[0.79971,0.17055,0.01520],[0.79125,0.16368,0.01387],[0.78260,0.15693,0.01264],[0.77377,0.15028,0.01148],[0.76476,0.14374,0.01041],[0.75556,0.13731,0.00942],[0.74617,0.13098,0.00851],[0.73661,0.12477,0.00769],[0.72686,0.11867,0.00695],[0.71692,0.11268,0.00629],[0.70680,0.10680,0.00571],
//
// [0.69650,0.10102,0.00522],[0.68602,0.09536,0.00481],[0.67535,0.08980,0.00449],[0.66449,0.08436,0.00424],[0.65345,0.07902,0.00408],[0.64223,0.07380,0.00401],[0.63082,0.06868,0.00401],[0.61923,0.06367,0.00410],[0.60746,0.05878,0.00427],[0.59550,0.05399,0.00453],[0.58336,0.04931,0.00486],[0.57103,0.04474,0.00529],[0.55852,0.04028,0.00579],[0.54583,0.03593,0.00638],[0.53295,0.03169,0.00705],[0.51989,0.02756,0.00780],[0.50664,0.02354,0.00863],[0.49321,0.01963,0.00955],[0.47960,0.01583,0.01055]]
[0.69650,0.10102,0.00522],[0.71602,0.09536,0.00481],[0.72535,0.08980,0.00449],[0.74449,0.08436,0.00424],[0.75345,0.07902,0.00408],[0.76223,0.07380,0.00401],[0.77082,0.06868,0.00401],[0.78923,0.06367,0.00410],[0.79746,0.05878,0.00427],[0.80550,0.05399,0.00453],[0.82336,0.04931,0.00486],[0.84103,0.04474,0.00529],[0.86852,0.04028,0.00579],[0.88583,0.03593,0.00638],[0.90295,0.03169,0.00705],[0.92989,0.02756,0.00780],[0.93664,0.02354,0.00863],[0.95321,0.01963,0.00955],[0.97960,0.01583,0.01055]];

// prettier-ignore
const FastColormapLUT: [number, number, number][] = [
  // [0.056,0.056,0.570],[0.064,0.067,0.572],[0.072,0.078,0.575],[0.079,0.088,0.582],[0.086,0.098,0.583],[0.092,0.108,0.59],[0.098,0.117,0.594],[0.104,0.127,0.6],[0.109,0.136,0.61],[0.115,0.145,0.62],[0.120,0.154,0.624],[0.125,0.163,0.63],[0.130,0.172,0.635],[0.135,0.181,0.64],
  [0.140,0.190,0.645],[0.144,0.199,0.65],[0.149,0.208,0.655],[0.153,0.217,0.66],[0.157,0.226,0.655],[0.161,0.235,0.66],[0.166,0.244,0.665],[0.170,0.253,0.67],[0.173,0.262,0.675],[0.177,0.271,0.68],[0.181,0.280,0.683],[0.185,0.289,0.689],[0.188,0.298,0.693],[0.192,0.307,0.697],[0.196,0.316,0.685],[0.199,0.325,0.703],[0.202,0.334,0.706],[0.206,0.343,0.714],[0.209,0.352,0.718],[0.212,0.361,0.724],[0.215,0.370,0.732],[0.218,0.379,0.740],[0.221,0.389,0.748],[0.224,0.398,0.756],[0.227,0.407,0.764],[0.230,0.416,0.772],[0.233,0.425,0.780],[0.236,0.435,0.788],[0.238,0.444,0.796],[0.241,0.453,0.804],[0.244,0.462,0.811],[0.249,0.471,0.816],[0.253,0.480,0.820],[0.258,0.488,0.825],[0.262,0.497,0.829],[0.266,0.505,0.833],[0.270,0.514,0.838],[0.274,0.523,0.842],[0.278,0.531,0.847],[0.282,0.540,0.851],[0.286,0.549,0.856],[0.290,0.557,0.860],[0.294,0.566,0.865],[0.297,0.575,0.869],[0.301,0.583,0.874],[0.305,0.592,0.878],[0.308,0.601,0.883],[0.311,0.610,0.887],[0.315,0.619,0.891],[0.318,0.627,0.896],[0.321,0.636,0.900],[0.325,0.645,0.905],[0.328,0.654,0.909],[0.331,0.663,0.914],[0.334,0.672,0.918],[0.337,0.681,0.923],[0.340,0.690,0.927],[0.343,0.699,0.932],[0.346,0.708,0.936],[0.348,0.717,0.940],[0.351,0.726,0.945],[0.354,0.735,0.949],[0.357,0.744,0.954],[0.369,0.750,0.954],[0.382,0.755,0.953],[0.394,0.760,0.952],[0.406,0.766,0.951],[0.418,0.771,0.950],[0.430,0.776,0.949],[0.441,0.781,0.948],[0.452,0.787,0.947],[0.463,0.792,0.946],[0.473,0.797,0.945],[0.484,0.803,0.944],[0.494,0.808,0.943],[0.504,0.814,0.942],[0.514,0.819,0.941],[0.523,0.824,0.940],[0.533,0.830,0.939],[0.542,0.835,0.937],[0.551,0.841,0.936],[0.561,0.846,0.935],[0.570,0.852,0.934],[0.578,0.857,0.933],[0.587,0.863,0.932],[0.596,0.868,0.931],[0.605,0.873,0.930],[0.613,0.879,0.929],[0.622,0.884,0.928],[0.630,0.890,0.926],[0.638,0.896,0.925],[0.647,0.901,0.924],[0.655,0.907,0.923],[0.663,0.912,0.922],[0.671,0.918,0.921],[0.679,0.923,0.919],[0.687,0.929,0.918],[0.700,0.931,0.911],[0.714,0.932,0.902],[0.728,0.932,0.894],[0.741,0.933,0.885],[0.755,0.934,0.877],[0.768,0.935,0.868],[0.780,0.936,0.860],[0.793,0.937,0.851],[0.805,0.937,0.842],[0.817,0.938,0.834],[0.828,0.939,0.825],[0.840,0.940,0.817],[0.851,0.941,0.808],[0.862,0.942,0.799],[0.873,0.943,0.790],[0.884,0.943,0.782],[0.894,0.944,0.773],[0.901,0.942,0.763],[0.905,0.937,0.751],[0.908,0.932,0.740],[0.912,0.927,0.728],[0.915,0.922,0.717],[0.918,0.917,0.705],[0.921,0.912,0.694],[0.924,0.908,0.682],[0.927,0.903,0.671],[0.930,0.898,0.659],[0.932,0.893,0.648],[0.935,0.888,0.636],[0.937,0.883,0.625],[0.940,0.878,0.613],[0.942,0.873,0.602],[0.944,0.868,0.590],[0.946,0.863,0.578],[0.948,0.858,0.567],[0.950,0.853,0.555],[0.952,0.849,0.544],[0.954,0.844,0.532],[0.956,0.839,0.521],[0.957,0.834,0.509],[0.957,0.827,0.502],[0.956,0.820,0.496],[0.956,0.813,0.489],[0.955,0.806,0.483],[0.954,0.799,0.476],[0.954,0.792,0.470],[0.953,0.785,0.463],[0.952,0.778,0.457],[0.951,0.770,0.450],[0.951,0.763,0.444],[0.950,0.756,0.437],[0.949,0.749,0.431],[0.948,0.742,0.424],[0.947,0.735,0.418],[0.946,0.728,0.412],[0.945,0.721,0.405],[0.944,0.714,0.399],[0.943,0.707,0.392],[0.942,0.700,0.386],[0.941,0.693,0.379],[0.940,0.686,0.373],[0.938,0.679,0.367],[0.937,0.672,0.360],[0.936,0.665,0.354],[0.935,0.657,0.348],[0.933,0.650,0.341],[0.932,0.643,0.335],[0.930,0.636,0.328],[0.929,0.629,0.322],[0.928,0.622,0.316],[0.924,0.615,0.311],[0.921,0.607,0.307],[0.918,0.600,0.302],[0.915,0.593,0.298],[0.911,0.585,0.293],[0.908,0.578,0.289],[0.904,0.571,0.284],[0.901,0.563,0.280],[0.898,0.556,0.276],[0.894,0.549,0.271],[0.891,0.541,0.267],[0.887,0.534,0.263],[0.884,0.527,0.258],[0.881,0.519,0.254],[0.877,0.512,0.249],[0.874,0.505,0.245],[0.870,0.497,0.241],[0.867,0.490,0.236],[0.863,0.482,0.232],[0.859,0.475,0.228],[0.856,0.468,0.224],[0.852,0.460,0.219],[0.849,0.453,0.215],[0.845,0.445,0.211],[0.841,0.438,0.207],[0.838,0.430,0.202],[0.834,0.423,0.198],[0.830,0.415,0.194],[0.827,0.407,0.190],[0.823,0.400,0.186],[0.819,0.392,0.181],[0.816,0.384,0.177],[0.812,0.377,0.173],[0.808,0.369,0.169],[0.804,0.361,0.165],[0.801,0.353,0.161],[0.795,0.347,0.159],[0.790,0.341,0.158],[0.784,0.334,0.157],[0.779,0.328,0.156],[0.774,0.322,0.155],[0.768,0.316,0.154],[0.763,0.310,0.153],[0.757,0.303,0.152],[0.752,0.297,0.151],[0.746,0.291,0.150],[0.741,0.285,0.149],[0.736,0.278,0.148],[0.730,0.272,0.147],[0.725,0.266,0.146],[0.719,0.259,0.145],[0.714,0.253,0.144],[0.709,0.246,0.143],[0.703,0.240,0.142],[0.698,0.233,0.141],[0.692,0.226,0.140],[0.687,0.220,0.139],[0.681,0.213,0.138],[0.676,0.206,0.137],[0.671,0.199,0.136],[0.665,0.192,0.135],[0.660,0.185,0.134],[0.655,0.178,0.133],[0.649,0.171,0.132],[0.644,0.164,0.131],[0.638,0.156,0.130],[0.633,0.148,0.128],[0.628,0.141,0.127],[0.622,0.133,0.126],[0.617,0.124,0.125],[0.611,0.116,0.124],[0.606,0.107,0.123],[0.601,0.097,0.122],[0.595,0.087,0.121],[0.590,0.077,0.119]]

/**
 * @param value value in the range [0, 1].  Values outside this range will be clamped.
 *
 * @returns [r, g, b] color value in the range [0, 1]
 */
export const turboColormap = (value: number): [number, number, number] => {
  const clampedValue = Math.min(1, Math.max(0, value));
  const index = Math.floor(clampedValue * (TurboColormapLUT.length - 1));
  return TurboColormapLUT[index];
};

export const fastColormap = (value: number): [number, number, number] => {
  const clampedValue = Math.min(1, Math.max(0, value));
  const index = Math.floor(clampedValue * (FastColormapLUT.length - 1));
  return FastColormapLUT[index];
};

const SixCategoryColorMap: [number, number, number][] = [
  [42 / 255, 132 / 255, 235 / 255],
  [109 / 255, 222 / 255, 194 / 255],
  [224 / 255, 24 / 255, 237 / 255],
  [255 / 255, 60 / 255, 15 / 255],
  [227 / 255, 220 / 255, 18 / 255],
  [44 / 255, 235 / 255, 30 / 255],
  [0, 0, 0],
];

export const sixCategoryColorMap = (value: number): [number, number, number] => {
  const clampedValue = Math.min(1, Math.max(0, value));
  const index = Math.floor(clampedValue * (SixCategoryColorMap.length - 1));
  return SixCategoryColorMap[index];
};
