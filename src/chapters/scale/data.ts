/** Content for the three playable worlds. Values are generic and written by hand; nothing is a real brand. */

export const A = '/assets/scale/';

export type Source = 'vision' | 'web' | 'vector' | 'image';

export interface Product {
  id: string;
  name: string;
  title: string;
  /** regions vision reads, in photo UV (x0, y0, x1, y1; origin top-left) with the tag shown on the photo */
  regions: { box: [number, number, number, number]; tag: string }[];
  /** 12 rows: 4 vision, 3 web, 2 vector, 3 image. `r` links a vision row to a region */
  rows: { k: string; v: string; src: Source; r?: number; thumbs?: 'near' | 'variants' }[];
  /** which cluster of the embedding cloud it lives in */
  cluster: number;
}

const img = (bg: string): Product['rows'] => [
  { k: 'Background', v: `Removed (${bg})`, src: 'image' },
  { k: 'Main image', v: 'Centred, clean sweep', src: 'image' },
  { k: 'Variants', v: 'Packshot + in use', src: 'image', thumbs: 'variants' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'shoe',
    name: 'Trail shoe',
    title: 'Trail running shoe, teal and charcoal',
    regions: [
      { box: [0.3, 0.36, 0.8, 0.6], tag: 'mesh upper' },
      { box: [0.12, 0.56, 0.92, 0.78], tag: 'lugged sole' },
      { box: [0.42, 0.28, 0.72, 0.5], tag: 'lace closure' },
      { box: [0.08, 0.24, 0.26, 0.44], tag: 'heel tab' },
    ],
    rows: [
      { k: 'Category', v: 'Footwear › Running › Trail', src: 'vision' },
      { k: 'Colour', v: 'Teal, charcoal, orange accent', src: 'vision', r: 0 },
      { k: 'Outsole', v: 'Lugged rubber', src: 'vision', r: 1 },
      { k: 'Closure', v: 'Lace-up, pull tab at heel', src: 'vision', r: 2 },
      { k: 'Weight', v: '290 g per shoe (size 42)', src: 'web' },
      { k: 'Heel-to-toe drop', v: '6 mm', src: 'web' },
      { k: 'Care', v: 'Hand wash, air dry', src: 'web' },
      { k: 'Similar items', v: '3 nearest', src: 'vector', thumbs: 'near' },
      { k: 'Tags', v: 'trail, grip, breathable', src: 'vector' },
      ...img('workbench'),
    ],
    cluster: 0,
  },
  {
    id: 'bottle',
    name: 'Steel bottle',
    title: 'Insulated steel bottle, olive green',
    regions: [
      { box: [0.38, 0.2, 0.68, 0.94], tag: 'matte body' },
      { box: [0.38, 0.8, 0.68, 0.95], tag: 'flat base' },
      { box: [0.4, 0.03, 0.66, 0.2], tag: 'screw cap' },
      { box: [0.58, 0.08, 0.72, 0.26], tag: 'carry loop' },
    ],
    rows: [
      { k: 'Category', v: 'Kitchen › Drinkware › Bottles', src: 'vision' },
      { k: 'Colour', v: 'Olive green, matte', src: 'vision', r: 0 },
      { k: 'Lid', v: 'Brushed steel screw cap', src: 'vision', r: 2 },
      { k: 'Carry', v: 'Loop on the cap', src: 'vision', r: 3 },
      { k: 'Capacity', v: '750 ml', src: 'web' },
      { k: 'Insulation', v: 'Double wall, vacuum', src: 'web' },
      { k: 'Care', v: 'Hand wash, no microwave', src: 'web' },
      { k: 'Similar items', v: '3 nearest', src: 'vector', thumbs: 'near' },
      { k: 'Tags', v: 'insulated, leak-proof, outdoor', src: 'vector' },
      ...img('kitchen counter'),
    ],
    cluster: 1,
  },
  {
    id: 'headphones',
    name: 'Headphones',
    title: 'Over-ear wireless headphones, cream',
    regions: [
      { box: [0.16, 0.3, 0.5, 0.66], tag: 'padded band' },
      { box: [0.3, 0.44, 0.64, 0.78], tag: 'closed cup' },
      { box: [0.42, 0.3, 0.76, 0.72], tag: 'leather cushion' },
      { box: [0.5, 0.6, 0.72, 0.76], tag: 'folding hinge' },
    ],
    rows: [
      { k: 'Category', v: 'Audio › Headphones › Over-ear', src: 'vision' },
      { k: 'Colour', v: 'Cream, tan cushions', src: 'vision', r: 2 },
      { k: 'Headband', v: 'Padded, adjustable', src: 'vision', r: 0 },
      { k: 'Design', v: 'Closed back, folding', src: 'vision', r: 1 },
      { k: 'Connection', v: 'Wireless, 3.5 mm cable option', src: 'web' },
      { k: 'Battery', v: 'Up to 30 h', src: 'web' },
      { k: 'Weight', v: '255 g', src: 'web' },
      { k: 'Similar items', v: '3 nearest', src: 'vector', thumbs: 'near' },
      { k: 'Tags', v: 'over-ear, wireless, travel', src: 'vector' },
      ...img('sofa'),
    ],
    cluster: 2,
  },
  {
    id: 'teapot',
    name: 'Teapot',
    title: 'Stoneware teapot, dark blue glaze',
    regions: [
      { box: [0.26, 0.1, 0.78, 0.5], tag: 'bamboo handle' },
      { box: [0.1, 0.44, 0.34, 0.74], tag: 'short spout' },
      { box: [0.36, 0.34, 0.66, 0.5], tag: 'fitted lid' },
      { box: [0.24, 0.46, 0.8, 0.86], tag: 'glazed body' },
    ],
    rows: [
      { k: 'Category', v: 'Kitchen › Tea › Teapots', src: 'vision' },
      { k: 'Colour', v: 'Dark blue, speckled glaze', src: 'vision', r: 3 },
      { k: 'Handle', v: 'Bamboo, overhead', src: 'vision', r: 0 },
      { k: 'Material', v: 'Stoneware', src: 'vision', r: 2 },
      { k: 'Capacity', v: '900 ml', src: 'web' },
      { k: 'Strainer', v: 'Built in at the spout', src: 'web' },
      { k: 'Care', v: 'Hand wash, not for stovetop', src: 'web' },
      { k: 'Similar items', v: '3 nearest', src: 'vector', thumbs: 'near' },
      { k: 'Tags', v: 'stoneware, handmade look, tea', src: 'vector' },
      ...img('dining table'),
    ],
    cluster: 3,
  },
  {
    id: 'backpack',
    name: 'Backpack',
    title: 'Waxed canvas backpack, mustard',
    regions: [
      { box: [0.2, 0.14, 0.78, 0.9], tag: 'waxed canvas' },
      { box: [0.3, 0.56, 0.74, 0.84], tag: 'front pocket' },
      { box: [0.4, 0.04, 0.6, 0.2], tag: 'grab handle' },
      { box: [0.34, 0.16, 0.72, 0.74], tag: 'leather straps' },
    ],
    rows: [
      { k: 'Category', v: 'Bags › Backpacks › Daypacks', src: 'vision' },
      { k: 'Colour', v: 'Mustard yellow, brown trim', src: 'vision', r: 0 },
      { k: 'Closure', v: 'Flap with two leather straps', src: 'vision', r: 3 },
      { k: 'Hardware', v: 'Brass buckles', src: 'vision', r: 3 },
      { k: 'Volume', v: '20 l', src: 'web' },
      { k: 'Fits', v: 'Laptop up to 15 in', src: 'web' },
      { k: 'Care', v: 'Wipe clean, re-wax yearly', src: 'web' },
      { k: 'Similar items', v: '3 nearest', src: 'vector', thumbs: 'near' },
      { k: 'Tags', v: 'canvas, everyday, water-resistant', src: 'vector' },
      ...img('brick wall'),
    ],
    cluster: 4,
  },
];

export const STAGES = ['Vision', 'Web search', 'Vector search', 'Image pipeline'];
export const STAGE_OF: Record<Source, number> = { vision: 0, web: 1, vector: 2, image: 3 };

export interface Market {
  code: string;
  name: string;
  cur: string;
  /** price shown on the tiles, already formatted, without the currency */
  prices: string[];
}

export const MARKETS: Market[] = [
  { code: 'SG', name: 'Singapore', cur: 'S$', prices: ['24.90', '18.50', '79.00', '32.00'] },
  { code: 'MY', name: 'Malaysia', cur: 'RM', prices: ['85.00', '62.90', '269', '109'] },
  { code: 'TH', name: 'Thailand', cur: '฿', prices: ['650', '490', '2,090', '840'] },
  { code: 'VN', name: 'Vietnam', cur: '₫', prices: ['469k', '349k', '1.49m', '599k'] },
  { code: 'PH', name: 'Philippines', cur: '₱', prices: ['1,050', '780', '3,350', '1,350'] },
  { code: 'ID', name: 'Indonesia', cur: 'Rp', prices: ['289k', '215k', '919k', '369k'] },
  { code: 'TW', name: 'Taiwan', cur: 'NT$', prices: ['590', '440', '1,880', '760'] },
];

export const FEATURES = ['Campaign banner', 'One-tap checkout', 'Login risk check'];

/** stream samples; `box` (x0, y0, x1, y1 in UV, origin top-left) is measured from the cut-out mask */
export interface Sample {
  id: string;
  label: string;
  box: [number, number, number, number];
}

export const SAMPLES: Sample[] = [
  { id: 'cat', label: 'cat', box: [0.12, 0.09, 0.69, 0.9] },
  { id: 'bicycle', label: 'bicycle', box: [0.16, 0.14, 0.9, 0.92] },
  { id: 'cone', label: 'cone', box: [0.25, 0.1, 0.74, 0.93] },
  { id: 'plant', label: 'plant', box: [0.02, 0.06, 0.95, 0.98] },
  { id: 'car', label: 'car', box: [0.07, 0.29, 0.91, 0.8] },
  { id: 'dog', label: 'dog', box: [0.09, 0.25, 0.87, 0.94] },
  { id: 'cup', label: 'cup', box: [0.02, 0.28, 0.95, 0.88] },
  { id: 'bench', label: 'bench', box: [0.04, 0.11, 0.94, 0.94] },
  { id: 'bag', label: 'bag', box: [0.26, 0.02, 0.77, 0.98] },
  { id: 'umbrella', label: 'umbrella', box: [0.04, 0.14, 0.93, 0.88] },
];
