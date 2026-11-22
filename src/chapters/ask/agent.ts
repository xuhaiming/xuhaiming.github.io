/**
 * The "Ask the site" demo. Nothing here calls a model or the network: each topic is a hand-written
 * script of plan, tool calls, observations and answer, played back on one clock. The same clock
 * drives the DOM log and (through `view`) the 3D staging, so the two cannot drift apart.
 */

export type ToolId = 'range' | 'systems' | 'scale' | 'path' | 'about' | 'links';
/** where a call is acted out: one of the six instruments, the floor he stands on, or all of them */
export type Target = ToolId | 'stage' | 'all';

export interface Call {
  tool: string;
  args: string;
  obs: string;
  target: Target;
  /** two or three words: the sub-goal this call serves, shown beside its cluster of points */
  goal: string;
}

export interface Topic {
  id: string;
  match: RegExp;
  plan: string;
  calls: Call[];
  answer: string;
  jump?: { label: string; to?: string; href?: string; tool: ToolId };
}

export const TOOL_COLOR: Record<ToolId | 'stage' | 'all', string> = {
  range: '#3f6bff',
  systems: '#b8ff3c',
  scale: '#ffa62b',
  path: '#2fe0c2',
  about: '#ff5d8f',
  links: '#c9b8ff',
  stage: '#9b7bff',
  all: '#8f86a8',
};

export const TOPICS: Record<string, Topic> = {
  build: {
    id: 'build',
    match: /\b(build|built|builds|make|makes|does|do|ship|ships|shipped|product|products|work|project|projects|experience)\b/i,
    plan: 'Find what he can do, then what he shipped with it, and group it by kind.',
    calls: [
      { tool: 'read_section', args: '"range"', obs: '4 disciplines: frontend, backend and cloud, AI agents, visual craft', target: 'range', goal: 'what he can do' },
      { tool: 'read_section', args: '"systems"', obs: 'agent systems built from scratch, 2 with usage numbers', target: 'systems', goal: 'what he shipped' },
      { tool: 'read_section', args: '"scale"', obs: 'consumer web for Shopee and Tencent', target: 'scale', goal: 'who used it' },
    ],
    answer:
      'Whole products, end to end. Consumer web for Shopee and Tencent, the services behind it, and in recent years AI agent systems that non-engineers use daily: an app builder that 80+ employees published apps on in its first month, and a team agent platform with 130+ monthly users.',
    jump: { label: 'See the work', to: 'systems', tool: 'systems' },
  },
  agents: {
    id: 'agents',
    match: /\b(agent|agents|agentic|ai|llm|llms|rag|mcp|model|models|eval|evals)\b/i,
    plan: 'Pull the agent projects, then check what makes them production-grade.',
    calls: [
      { tool: 'search_work', args: '{ topic: "agents" }', obs: '3 matches: app builder, team agent platform, knowledge base', target: 'systems', goal: 'the agent projects' },
      { tool: 'get_facts', args: '["evals", "tracing", "guardrails"]', obs: 'all three present on the agent platform', target: 'systems', goal: 'production-grade?' },
    ],
    answer:
      'Three systems, each built from scratch: a company-wide app builder driven by plain language, a team agent platform with tool calling and MCP, and a retrieval knowledge base served to agents over MCP. The part he spends most care on is making them dependable: evaluation sets, tracing, cost and latency work, and permissions and guardrails around tool use.',
    jump: { label: 'See the agent work', to: 'systems', tool: 'systems' },
  },
  lead: {
    id: 'lead',
    match: /\b(lead|leads|led|leader|leadership|team|teams|manage|managed|manager|mentor|mentoring|senior|staff)\b/i,
    plan: 'Check the path for roles with people in them.',
    calls: [
      { tool: 'read_section', args: '"path"', obs: 'Shopee, 2020 to 2023: Expert Engineer, Frontend Team Lead', target: 'path', goal: 'roles with people' },
      { tool: 'get_facts', args: '["team size", "mentoring"]', obs: 'team of 7 at Shopee; mentoring at Trustana', target: 'path', goal: 'how many, how' },
    ],
    answer:
      'Yes. At Shopee he led seven frontend engineers across the consumer site, merchant sites and admin portals, set the code-review standards and ran performance reviews. At Trustana he was Senior Staff, owning architecture and mentoring engineers.',
    jump: { label: 'See the path', to: 'path', tool: 'path' },
  },
  stack: {
    id: 'stack',
    match: /\b(stack|tech|technology|technologies|language|languages|framework|frameworks|react|next|node|typescript|python|aws|frontend|backend|skills?)\b/i,
    plan: 'Read the tool lists under each discipline.',
    calls: [
      { tool: 'read_section', args: '"range"', obs: 'React, Next.js, TypeScript · Node.js, Python, AWS · MCP, RAG, evals · Three.js, GLSL', target: 'range', goal: 'tools per discipline' },
    ],
    answer:
      'TypeScript end to end: React and Next.js in front, Node.js behind, Python where the models live. AWS for the serverless parts, and Three.js with GLSL when something needs to move like this page does.',
    jump: { label: 'See the range', to: 'range', tool: 'range' },
  },
  site: {
    id: 'site',
    match: /\b(site|website|page|webgl|three|3d|shader|shaders|made|design|designed|character|figure|this)\b/i,
    plan: 'Inspect the page that is running right now, then list what it loads.',
    calls: [
      { tool: 'inspect_page', args: '', obs: 'Vite, TypeScript, Three.js, Lenis; no UI framework', target: 'stage', goal: 'what is running' },
      { tool: 'list_assets', args: '', obs: '1 rigged character; props, stills and loops generated locally as placeholders; 1 variable font', target: 'range', goal: 'what it loads' },
    ],
    answer:
      'By hand, with agents helping. It is Vite and TypeScript with Three.js and no UI framework. Each chapter is its own world driven by the scroll, and the light, the points and the rifts between chapters are custom shaders. The props, stills and loops are placeholders generated locally, on his own machine.',
    // straight to the visual craft bench in the range (the progress after '@')
    jump: { label: 'See the range', to: 'range@0.825', tool: 'range' },
  },
  reach: {
    id: 'reach',
    match: /\b(reach|contact|hire|hiring|email|mail|linkedin|github|talk|message|available|interview)\b/i,
    plan: 'Look up his public links.',
    calls: [{ tool: 'get_links', args: '', obs: 'linkedin.com/in/xu-haiming-48502869 · github.com/xuhaiming', target: 'links', goal: 'public links' }],
    answer: 'LinkedIn is the best way to reach him. He is based in Singapore.',
    jump: { label: 'Open LinkedIn', href: 'https://www.linkedin.com/in/xu-haiming-48502869', tool: 'links' },
  },
};

const ORDER = ['reach', 'agents', 'lead', 'stack', 'site', 'build'];

const FALLBACK = (query: string): Topic => ({
  id: 'fallback',
  match: /$^/,
  plan: 'Look for a topic that matches the question.',
  calls: [{ tool: 'search_site', args: JSON.stringify(query.slice(0, 60)), obs: 'no confident match', target: 'all', goal: 'any match?' }],
  answer:
    'Nothing came back, and I would rather say so than guess. This demo only knows a few topics: what he builds, his agent work, leading teams, his stack, how this site was made, and how to reach him. Try one of the suggested questions.',
});

export interface Step {
  kind: 'you' | 'plan' | 'call' | 'answer';
  /** seconds */
  dur: number;
  call?: Call;
  /** index among the calls */
  ci: number;
  li?: HTMLLIElement;
}

export interface Run {
  topic: Topic;
  question: string;
  steps: Step[];
  fallback: boolean;
  /** fraction of the answer step spent merging the packets before the words start */
  merge: number;
}

/** what the scene should show right now */
export interface View {
  run: Run | null;
  /** step index and progress 0..1 through it */
  k: number;
  u: number;
  /** true while a finished run is being replayed from the log */
  replay: boolean;
  /** true while the run is playing for the first time */
  live: boolean;
  /** tool lit from the console (hovered chip or tag), and the idle suggestion */
  hot: ToolId | null;
  pulse: ToolId | null;
  /** 0..1 envelope of the idle pulse */
  pulseAmt: number;
  /** tool the camera glances at before a jump, with its 0..1 envelope */
  glance: ToolId | null;
  glanceAmt: number;
  /** bumps on every new question; the scene uses it to restart easing */
  seq: number;
}

export interface ConsoleOptions {
  /** capture mode: no delays */
  quick: boolean;
  /** capture hooks: start with this topic finished, or frozen at a step */
  act?: string | null;
  step?: number | null;
  stepU?: number | null;
  /** capture hooks for the timed paths: play this topic for `ff` seconds on the real clock code, or replay step `replay` of a finished run */
  live?: string | null;
  ff?: number;
  replay?: number | null;
  /** travel to a chapter (after the glance) */
  go: (id: string) => void;
}

export const OBS_AT = 0.6;
const GLANCE = 0.85;

export function mountConsole(root: HTMLElement, o: ConsoleOptions) {
  const form = root.querySelector<HTMLFormElement>('.a-form')!;
  const input = root.querySelector<HTMLInputElement>('.a-form input')!;
  const log = root.querySelector<HTMLOListElement>('.a-run')!;
  const hint = root.querySelector<HTMLElement>('.a-hint');
  const next = root.querySelector<HTMLElement>('.a-next');
  const card = root.querySelector<HTMLElement>('.a-card')!;
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.a-chips button'));
  const tags = Array.from(root.querySelectorAll<HTMLButtonElement>('.a-tag'));

  const view: View = { run: null, k: 0, u: 0, replay: false, live: false, hot: null, pulse: null, pulseAmt: 0, glance: null, glanceAmt: 0, seq: 0 };
  let run: Run | null = null;
  let k = 0;
  let u = 0;
  let live = false;
  let frozen = false;
  let obsShown = false;
  let words: string[] = [];
  let shown = -1;
  let typed: HTMLElement | null = null;
  // replay
  let insp = -1;
  let pinned = -1;
  let iu = 0;
  // idle suggestion
  let idle = 0;
  let pulseI = -1;
  let hovering = false;
  // glance
  let gl = 0;
  let glGo: string | null = null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const colorOf = (s: Step) => (s.kind === 'call' ? TOOL_COLOR[s.call!.target] : TOOL_COLOR.stage);

  function row(i: number, s: Step) {
    const names = { you: 'You', plan: 'Plan', call: 'Tool call', answer: 'Answer' } as const;
    const li = el('li', `a-step a-${s.kind}`);
    li.dataset.hit = '';
    li.dataset.i = String(i);
    li.style.setProperty('--tool', colorOf(s));
    const role = el('button', 'a-role');
    role.type = 'button';
    role.setAttribute('aria-label', `Step ${i + 1}, ${names[s.kind]}: replay it in the scene`);
    role.setAttribute('aria-pressed', 'false');
    role.append(el('i'), el('span', '', names[s.kind]));
    const body = el('div', 'a-body');
    li.append(role, body);
    log.append(li);
    s.li = li;

    li.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && inspect(i));
    li.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && insp === i && pinned !== i && inspect(-1));
    role.addEventListener('focus', () => role.matches(':focus-visible') && inspect(i));
    role.addEventListener('blur', () => insp === i && pinned !== i && inspect(-1));
    li.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a')) return;
      // touch and keyboard: a press pins the replay, a second press releases it
      if (pinned === i) {
        pinned = -1;
        inspect(-1);
      } else {
        pinned = i;
        inspect(i, true);
      }
      syncPins();
    });
    return body;
  }

  function syncPins() {
    run?.steps.forEach((s, i) => s.li?.querySelector('.a-role')?.setAttribute('aria-pressed', String(pinned === i)));
  }

  function inspect(i: number, restart = false) {
    if (!run || live || frozen) return;
    if (i === insp && !restart) return;
    insp = i;
    iu = 0;
    run.steps.forEach((s, j) => s.li?.classList.toggle('replay', j === i));
    card.classList.toggle('replaying', i >= 0);
  }

  function enter(i: number) {
    const s = run!.steps[i];
    const body = row(i, s);
    run!.steps.forEach((x, j) => x.li?.classList.toggle('now', j === i));
    obsShown = false;
    if (s.kind === 'you') body.textContent = run!.question;
    else if (s.kind === 'plan') body.textContent = run!.topic.plan;
    else if (s.kind === 'call') {
      const code = el('code');
      code.append(el('b', '', s.call!.tool), `(${s.call!.args})`);
      body.append(code);
    } else {
      // the full text for assistive tech at once, the typed copy for the eye
      body.append(el('p', 'sr', run!.topic.answer));
      typed = el('p', 'a-typed');
      typed.setAttribute('aria-hidden', 'true');
      body.append(typed);
      words = run!.topic.answer.split(' ');
      shown = -1;
    }
    if (!o.quick) keepVisible(s.li!);
  }

  /** the log only scrolls inside itself (phones); never the page */
  function keepVisible(li: HTMLElement) {
    if (log.scrollHeight > log.clientHeight + 4) log.scrollTo({ top: li.offsetTop - 8, behavior: 'smooth' });
  }

  function progress(i: number, at: number) {
    const s = run!.steps[i];
    if (s.kind === 'call' && !obsShown && at >= OBS_AT) {
      obsShown = true;
      const obs = el('div', 'a-obs', s.call!.obs);
      if (s.call!.target === 'all') obs.classList.add('empty');
      s.li!.querySelector('.a-body')!.append(obs);
      s.li!.classList.add('back');
    }
    if (s.kind === 'answer' && typed) {
      const m = run!.merge;
      const n = at >= 1 ? words.length : Math.floor(words.length * Math.max(0, (at - m) / (1 - m)));
      if (n !== shown) {
        shown = n;
        typed.textContent = words.slice(0, n).join(' ');
        typed.classList.toggle('typing', n < words.length);
      }
    }
  }

  function finish() {
    live = false;
    const last = run!.steps[run!.steps.length - 1];
    run!.steps.forEach((x) => x.li?.classList.remove('now'));
    const j = run!.topic.jump;
    if (j && last.li && !(next ?? last.li).querySelector('.a-jump')) {
      const a = el('a', 'a-jump');
      a.dataset.native = '';
      a.dataset.tool = j.tool;
      a.style.setProperty('--tool', TOOL_COLOR[j.tool]);
      a.href = j.href ?? `#${j.to!.split('@')[0]}`;
      a.append(el('span', '', j.label));
      a.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4.2 3H9v4.8" /></svg>');
      if (j.href) {
        a.target = '_blank';
        a.rel = 'noopener';
        a.addEventListener('click', () => glance(j.tool, null));
      } else {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          glance(j.tool, j.to!);
        });
      }
      a.addEventListener('pointerenter', () => (view.hot = j.tool));
      a.addEventListener('pointerleave', () => (view.hot = null));
      a.addEventListener('focus', () => (view.hot = j.tool));
      a.addEventListener('blur', () => (view.hot = null));
      (next ?? last.li.querySelector('.a-body')!).append(a);
    }
    card.classList.remove('busy');
    card.classList.add('done');
    if (last.li && log.scrollHeight > log.clientHeight + 4) log.scrollTo({ top: last.li.offsetTop - 8, behavior: o.quick ? 'instant' : 'smooth' });
    if (hint) hint.hidden = false;
  }

  function glance(tool: ToolId, to: string | null) {
    if (o.quick) {
      if (to) o.go(to);
      return;
    }
    view.glance = tool;
    gl = 0.0001;
    glGo = to;
  }

  function start(question: string, id?: string) {
    const key = id ?? ORDER.find((x) => TOPICS[x].match.test(question));
    const topic = key && TOPICS[key] ? TOPICS[key] : FALLBACK(question);
    const n = topic.answer.split(' ').length;
    const type = Math.min(n * 0.016, 1.1);
    const steps: Step[] = [
      { kind: 'you', dur: 0.3, ci: -1 },
      { kind: 'plan', dur: 0.5, ci: -1 },
      ...topic.calls.map((c, i): Step => ({ kind: 'call', dur: c.target === 'all' ? 1.0 : 0.75, call: c, ci: i })),
      { kind: 'answer', dur: 0.4 + type, ci: -1 },
    ];
    run = { topic, question, steps, fallback: topic.id === 'fallback', merge: 0.4 / (0.4 + type) };
    log.replaceChildren();
    next?.replaceChildren();
    view.hot = null;
    insp = -1;
    pinned = -1;
    frozen = false;
    k = 0;
    u = 0;
    live = true;
    view.seq++;
    card.classList.add('busy', 'has-run');
    card.classList.remove('done', 'replaying');
    card.dataset.topic = topic.id;
    if (hint) hint.hidden = true;
    chips.forEach((b) => b.classList.toggle('on', b.dataset.topic === topic.id));
    enter(0);
  }

  /** capture mode / reduced clocks: jump straight to a state */
  function jumpTo(stepIndex: number | null, at: number) {
    if (!run) return;
    const end = stepIndex === null ? run.steps.length - 1 : Math.min(run.steps.length - 1, Math.max(0, stepIndex));
    for (let i = 0; i <= end; i++) {
      if (i > 0) enter(i);
      progress(i, i < end ? 1 : stepIndex === null ? 1 : at);
    }
    k = end;
    u = stepIndex === null ? 1 : at;
    if (stepIndex === null) finish();
    else {
      live = false;
      frozen = true;
    }
  }

  function ask(question: string, id?: string) {
    start(question, id);
    // the question has been taken: leave the field empty for the next one
    input.value = '';
    if (o.quick) jumpTo(null, 1);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      input.focus();
      return;
    }
    ask(q);
  });

  const hover = (b: HTMLElement, tool: ToolId | undefined) => {
    if (!tool) return;
    const on = () => {
      view.hot = tool;
      hovering = true;
    };
    const off = () => {
      if (view.hot === tool) view.hot = null;
      hovering = false;
    };
    b.addEventListener('pointerenter', on);
    b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on);
    b.addEventListener('blur', off);
  };

  const qOf = (b: HTMLElement) => (b.querySelector('.l')?.textContent ?? b.textContent ?? '').trim();
  chips.forEach((b) => {
    hover(b, b.dataset.tool as ToolId);
    b.addEventListener('click', () => {
      input.value = qOf(b);
      ask(qOf(b), b.dataset.topic);
    });
  });
  tags.forEach((b) => {
    hover(b, b.dataset.tool as ToolId);
    b.addEventListener('click', () => askTool(b.dataset.tool as ToolId));
  });

  /** an instrument was pressed (its tag, or the object itself): ask the question that belongs to it */
  function askTool(tool: ToolId) {
    const chip = chips.find((c) => c.dataset.tool === tool);
    if (!chip) return;
    input.value = qOf(chip);
    ask(qOf(chip), chip.dataset.topic);
  }

  function tick(dt: number) {
    // first play
    if (live && run) {
      u += dt / run.steps[k].dur;
      progress(k, Math.min(u, 1));
      if (u >= 1) {
        if (k < run.steps.length - 1) {
          k++;
          u = 0;
          enter(k);
        } else {
          u = 1;
          finish();
        }
      }
    }
    // replay of one step: play, hold, loop
    if (insp >= 0 && run) {
      const d = run.steps[insp].kind === 'answer' ? 2.6 : run.steps[insp].dur;
      iu += dt / d;
      if (iu > 1 + 0.9 / d) iu = 0;
    }
    // idle suggestion: one chip (and its instrument) pulses at a time
    if (!run && !hovering && chips.length) {
      idle += dt;
      const period = 3.2;
      const i = Math.floor(idle / period) % chips.length;
      const ph = (idle % period) / period;
      if (i !== pulseI) {
        pulseI = i;
        chips.forEach((c, j) => c.classList.toggle('pulse', j === i));
      }
      view.pulse = (chips[i].dataset.tool as ToolId) ?? null;
      view.pulseAmt = Math.sin(Math.min(1, ph * 1.25) * Math.PI) ** 2;
    } else if (pulseI >= 0) {
      pulseI = -1;
      chips.forEach((c) => c.classList.remove('pulse'));
      view.pulse = null;
      view.pulseAmt = 0;
    }
    // glance before a jump
    if (gl > 0) {
      gl += dt / GLANCE;
      view.glanceAmt = Math.sin(Math.min(1, gl) * Math.PI * 0.5);
      if (gl >= 1) {
        const to = glGo;
        glGo = null;
        if (to) {
          gl = 0;
          o.go(to);
          // let go of the camera once the page is on its way
          setTimeout(() => {
            view.glance = null;
            view.glanceAmt = 0;
          }, 500);
        } else if (gl >= 2.2) {
          gl = 0;
          view.glance = null;
          view.glanceAmt = 0;
        } else view.glanceAmt = Math.min(1, (2.2 - gl) / 0.6);
      }
    }

    view.run = run;
    view.live = live;
    view.replay = insp >= 0;
    if (insp >= 0) {
      view.k = insp;
      view.u = Math.min(1, iu);
    } else {
      view.k = k;
      view.u = Math.min(1, u);
    }
  }

  // capture hooks
  if (o.act) {
    const chip = chips.find((c) => c.dataset.topic === o.act);
    const q = (chip && qOf(chip)) ?? (o.act === 'fallback' ? 'What is his favourite colour?' : o.act);
    input.value = q;
    start(q, TOPICS[o.act] ? o.act : o.act === 'fallback' ? '__none__' : undefined);
    jumpTo(o.step ?? null, o.stepU ?? 0.5);
    if (o.replay != null && o.step == null) {
      inspect(o.replay);
      iu = o.stepU ?? 0.5;
    }
  } else if (o.live) {
    const chip = chips.find((c) => c.dataset.topic === o.live);
    input.value = chip ? qOf(chip) : 'What is his favourite colour?';
    start(input.value, chip ? o.live : undefined);
    for (let s = 0; s < (o.ff ?? 3); s += 0.05) tick(0.05);
  }

  return { view, tick, askTool, isBusy: () => live };
}
