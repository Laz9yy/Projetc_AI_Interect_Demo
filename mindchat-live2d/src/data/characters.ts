import type { CharacterConfig } from '../types';

export const characterPresets: CharacterConfig[] = [
  {
    name: 'HK416',
    modelUrl: '/models/hk416_c2/model.json',
    personality: '冷静沉着、实力超群的人形战术人偶，说话简洁但偶尔流露出温柔的一面',
    greeting: '指挥官，我是 HK416。…有什么指示吗？',
  },
];

// Eikanya 模型库 CDN
export const eikanyaModelBase = 'https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@master/';
