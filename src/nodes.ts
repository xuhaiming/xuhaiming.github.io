/**
 * The story's nodes: every chapter and the key beats inside it, in reading order.
 * One table, used by the node navigator (the bottom rail, the top-bar previous / next buttons,
 * J / K, and the node chips in the phone menu).
 *
 * `p` is chapter progress 0..1 (the same `f.p` the chapter's update() receives), chosen where the
 * beat is fully composed on screen. When a chapter's timing changes, re-check its row here:
 *   impeccable shot "http://localhost:5173/?shot&only=<id>&c=<id>&p=<p>" --viewport 1440x900,390x844
 * The first node of a chapter is the chapter itself; its label is the chapter's name.
 */

export interface StoryNode {
  /** unique id, also used as data-node on the controls */
  id: string;
  /** chapter progress where the beat is fully composed */
  p: number;
  /** short label, shown on hover / focus and read by assistive tech */
  label: string;
}

export interface StoryChapter {
  /** chapter id: the <section> id and folder name */
  id: string;
  /** name shown on the rail */
  label: string;
  /** the chapter's own node first, then its beats */
  nodes: StoryNode[];
}

export const STORY: StoryChapter[] = [
  {
    id: 'origin',
    label: 'Intro',
    nodes: [
      { id: 'origin', p: 0, label: 'Intro' },
      // .o-b is shown over 0.26..0.58
      { id: 'origin-years', p: 0.42, label: 'Twelve years in' },
      // .o-c over 0.7..1, the rift is well open by 0.86
      { id: 'origin-door', p: 0.86, label: 'The door' },
    ],
  },
  {
    id: 'range',
    label: 'Range',
    // the chapter's own station buttons use ARR[i] + (LEAVE[i] - ARR[i]) * 0.42
    nodes: [
      { id: 'range', p: 0.02, label: 'Range' },
      { id: 'range-frontend', p: 0.198, label: 'Frontend' },
      { id: 'range-backend', p: 0.428, label: 'Backend and cloud' },
      { id: 'range-agents', p: 0.638, label: 'AI agents' },
      { id: 'range-craft', p: 0.825, label: 'Visual craft' },
    ],
  },
  {
    id: 'systems',
    label: 'Agent systems',
    // the three cases are shown over 0.06..0.33, 0.405..0.662, 0.738..0.966
    nodes: [
      { id: 'systems', p: 0.02, label: 'Agent systems' },
      { id: 'systems-builder', p: 0.2, label: 'App builder' },
      { id: 'systems-platform', p: 0.53, label: 'Agent platform' },
      { id: 'systems-knowledge', p: 0.85, label: 'Knowledge base' },
    ],
  },
  {
    id: 'scale',
    label: 'At scale',
    // the intro is out by 0.035; studio 0..0.285, market 0.375..0.625, bench 0.72..1
    nodes: [
      { id: 'scale', p: 0.005, label: 'Products at scale' },
      { id: 'scale-trustana', p: 0.15, label: 'Trustana' },
      { id: 'scale-shopee', p: 0.5, label: 'Shopee' },
      { id: 'scale-tencent', p: 0.86, label: 'Tencent' },
    ],
  },
  {
    id: 'path',
    label: 'Path',
    // where he stands at the first stop of each place (path/data.ts pOf(STOPS[i].x))
    nodes: [
      { id: 'path', p: 0.02, label: 'The path so far' },
      { id: 'path-nl', p: 0.128, label: 'The Netherlands' },
      { id: 'path-bj', p: 0.326, label: 'Beijing' },
      { id: 'path-sz', p: 0.467, label: 'Shenzhen' },
      { id: 'path-sg', p: 0.68, label: 'Singapore' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    // beats: .a-one 0.02..0.3, .a-two 0.33..0.6, the lens alone 0.66..0.79, the rift open from ~0.96
    nodes: [
      { id: 'about', p: 0.15, label: 'About' },
      { id: 'about-likes', p: 0.46, label: 'What I like' },
      { id: 'about-lens', p: 0.72, label: 'The lens' },
      { id: 'about-rift', p: 0.97, label: 'The way on' },
    ],
  },
  {
    id: 'ask',
    label: 'Ask',
    // the console card is fully in from 0.12
    nodes: [{ id: 'ask', p: 0.2, label: 'Ask the site' }],
  },
  {
    id: 'contact',
    label: 'Contact',
    // the copy is in from 0.3, the scene starts to leave at 0.72
    nodes: [{ id: 'contact', p: 0.4, label: 'Contact' }],
  },
];
