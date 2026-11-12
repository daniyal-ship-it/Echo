import { test, expect, type Page } from '@playwright/test';

// Phase 3B: the brain exploration experience around the anatomical canvas.
// Everything runs against the real application state of one isolated test workspace. The only
// stubbing is a delay added to real graph responses, to observe loading states.
const origin = 'http://127.0.0.1:3100';
const headers = { origin };
// One workspace for the whole file: the server allows ten registrations per fifteen minutes
// across the browser suite.
let account: { email: string; password: string } | null = null;
const ids: Record<string, string> = {};

async function signIn(page: Page) {
  if (account) {
    expect((await page.request.post('/api/auth/login', { headers, data: account })).status()).toBe(
      200,
    );
    return;
  }
  const created = {
    email: `phase3b-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`,
    password: 'Isolated phase 3b password 42',
  };
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers,
        data: { ...created, name: 'Phase 3B review' },
      })
    ).status(),
  ).toBe(201);
  const notes: [string, string, string, string[]][] = [
    [
      'Aurora launch decision',
      'TEST FIXTURE: Launch Aurora in November.',
      'frontal',
      ['aurora', 'launch'],
    ],
    [
      'Aurora review notes',
      'TEST FIXTURE: The Aurora review is in October.',
      'frontal',
      ['aurora', 'launch'],
    ],
    ['Quarterly goals', 'TEST FIXTURE: Ship the atlas this quarter.', 'frontal', ['goals']],
    [
      'Optical design ideas',
      'TEST FIXTURE: A lens diagram for the telescope.',
      'occipital',
      ['optics'],
    ],
    [
      'Observatory reading list',
      'TEST FIXTURE: Books on mirror grinding.',
      'parietal',
      ['reading'],
    ],
  ];
  for (const [title, content, region, tags] of notes) {
    const response = await page.request.post('/api/memories', {
      headers,
      data: { title, content, region, tags },
    });
    expect(response.status()).toBe(201);
    ids[title] = (await response.json()).id;
  }
  // One real, user-made connection across lobes, so following a link can be tested.
  expect(
    (
      await page.request.post('/api/edges', {
        headers,
        data: {
          sourceId: ids['Aurora launch decision'],
          targetId: ids['Optical design ideas'],
          relationship: 'design context',
          evidence: 'Test fixture: the launch uses this optical design.',
        },
      })
    ).status(),
  ).toBe(201);
  account = created;
}
async function open(page: Page) {
  await signIn(page);
  await page.goto('/');
  // Signed in and at the top of the trail, on any screen size.
  await expect(page.locator('.avatar')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-place', 'whole');
}
const trail = (page: Page) => page.getByRole('navigation', { name: 'Brain navigation' });
const depth = (page: Page) => page.locator('.depth-label');
const back = (page: Page, to: string) =>
  page.getByRole('button', { name: `Back to ${to}`, exact: true });
const topicPanel = (page: Page) => page.getByRole('region', { name: 'Memories in topic' });
function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('whole brain → lobe → topic → memory → linked memory, and back through every step', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await open(page);
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toContainText(
    '5 memories placed across four lobes',
  );
  await expect(depth(page)).toContainText('01 / WHOLE BRAIN');
  await expect(page.locator('.scene-title h1')).toHaveText('Memory atlas');
  await expect(page.locator('.trail-back')).toHaveCount(0);

  await page.getByRole('button', { name: 'Enter Frontal lobe, 3 memories' }).click();
  await expect(depth(page)).toContainText('02 / LOBE');
  await expect(page.locator('.scene-title h1')).toHaveText('Frontal cortex');
  await expect(trail(page)).toContainText('Frontal');
  await expect(back(page, 'whole brain')).toBeVisible();
  await expect(page.getByTestId('place-announcement')).toHaveText('Frontal lobe, 3 memories');

  await page.getByRole('button', { name: 'Explore #aurora, 2 memories' }).click();
  await expect(depth(page)).toContainText('03 / TOPIC');
  await expect(topicPanel(page).getByRole('heading', { name: '#aurora' })).toBeVisible();
  await expect(back(page, 'Frontal lobe')).toBeVisible();

  await topicPanel(page)
    .getByRole('button', { name: /Aurora launch decision/ })
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Aurora launch decision');
  await expect(depth(page)).toContainText('04 / MEMORY');
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('Memory');
  await expect(page.getByTestId('place-announcement')).toHaveText(
    'Memory opened: Aurora launch decision',
  );
  await expect(back(page, '#aurora')).toBeVisible();

  // Following a real connection must not lose the memory the reader came from.
  await page.getByRole('button', { name: /Links \(2\)/ }).click();
  await page
    .locator('.edge-card')
    .getByRole('button', { name: /Optical design ideas/ })
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Optical design ideas');
  await expect(trail(page)).toContainText('Occipital');
  await back(page, 'memory').click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Aurora launch decision');
  await expect(trail(page)).toContainText('#aurora');

  await back(page, '#aurora').click();
  await expect(topicPanel(page).getByRole('heading', { name: '#aurora' })).toBeVisible();
  await expect(topicPanel(page).locator('.topic-card')).toHaveCount(2);
  await back(page, 'Frontal lobe').click();
  await expect(page.getByRole('region', { name: 'Topic and project clusters' })).toBeVisible();
  await expect(depth(page)).toContainText('02 / LOBE');
  await back(page, 'whole brain').click();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  await expect(page.locator('.trail-back')).toHaveCount(0);

  // The browser's own Back and Forward walk the same trail.
  await page.goForward();
  await expect(page.getByRole('region', { name: 'Topic and project clusters' })).toBeVisible();
  await page.goForward();
  await expect(topicPanel(page).getByRole('heading', { name: '#aurora' })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard: search with /, open a source, and Escape returns to the same results', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await open(page);
  let searches = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/retrieve')) searches++;
  });
  await page.keyboard.press('/');
  const ask = page.getByLabel('Ask your memory');
  await expect(ask).toBeFocused();
  await page.keyboard.type('telescope');
  await page.keyboard.press('Enter');
  await expect(page.locator('.citation')).toHaveCount(1);
  await expect(depth(page)).toHaveText('SEARCH RESULTS');
  await expect(page.locator('.scene-title h1')).toHaveText('Retrieved sources');
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('Results');

  // A focused saved memory, reached by keyboard alone.
  await page.locator('.citation').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.memory-intro h2')).toHaveText('Optical design ideas');
  await expect(page.locator('.original-content')).toContainText('lens diagram');
  await expect(back(page, 'results')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.retrieval-panel h2')).toHaveText('telescope');
  await expect(page.locator('.citation')).toHaveCount(1);
  // Going back shows the results already retrieved; it does not search again.
  expect(searches).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  // Escape at the top of the trail does nothing surprising.
  await page.keyboard.press('Escape');
  await expect(page.locator('.scene-title h1')).toHaveText('Memory atlas');

  // Lobes are reachable and operable from the keyboard, with a visible focus ring.
  const lobe = page.getByRole('button', { name: 'Enter Occipital lobe, 1 memory' });
  await lobe.focus();
  expect(await lobe.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('.scene-title h1')).toHaveText('Occipital cortex');
  // Typing in a field never triggers navigation shortcuts.
  await page.getByLabel('Find a topic or project').pressSequentially('/optics');
  await expect(page.locator('.scene-title h1')).toHaveText('Occipital cortex');
  expect(errors).toEqual([]);
});

test('the context panel can be put away, remembers the choice, and returns for a memory', async ({
  page,
}) => {
  await open(page);
  const canvas = page.getByTestId('brain-viewport');
  const wide = (await canvas.boundingBox())!.width;
  await page.getByRole('button', { name: 'Hide context panel', exact: true }).click();
  await expect(page.locator('.inspector')).toBeHidden();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(wide + 250);
  // Lobe level stays on the canvas and trail while the panel is hidden.
  await page.locator('.region-row').filter({ hasText: 'Frontal' }).click();
  await expect(depth(page)).toContainText('02 / LOBE');
  await expect(page.locator('.inspector')).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Show context panel', exact: true })).toBeVisible();
  await expect(page.locator('.inspector')).toBeHidden();
  // A memory lives in the panel, so opening one always reveals it.
  await page.getByRole('button', { name: /Quarterly goals/ }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Quarterly goals');
  await expect(page.locator('.inspector')).toBeVisible();
  await page.getByRole('button', { name: 'Close memory', exact: true }).click();
  await page.getByRole('button', { name: 'Show context panel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();

  // Immersive view keeps the trail and lobes, and floats an open memory beside the anatomy.
  await page.getByRole('button', { name: /Quarterly goals/ }).click();
  await page.getByRole('button', { name: 'Enter immersive view' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(trail(page)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Cerebral lobes' })).toBeVisible();
  await expect(page.locator('.memory-intro h2')).toHaveText('Quarterly goals');
  const panel = (await page.locator('.inspector').boundingBox())!;
  const stage = (await canvas.boundingBox())!;
  expect(stage.x + stage.width).toBeLessThanOrEqual(panel.x + 1);
  await page.getByRole('button', { name: 'Occipital lobe, 1 memory' }).click();
  await expect(page.locator('.inspector')).toBeHidden();
  await expect(trail(page)).toContainText('Occipital');
  await page.getByRole('button', { name: 'Show workspace' }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
});

test('empty and loading states are truthful', async ({ page }) => {
  await open(page);
  // A lobe with no records says so on the canvas and in the panel; nothing is invented.
  await page.getByRole('button', { name: 'Enter Temporal lobe, 0 memories' }).click();
  const notice = page.locator('.canvas-notice');
  await expect(notice).toContainText('No memories in the Temporal lobe yet.');
  await expect(page.getByRole('region', { name: 'Topic and project clusters' })).toContainText(
    'No memories in this view yet.',
  );
  await notice.getByRole('button', { name: 'Return to the whole brain' }).click();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  await expect(notice).toHaveCount(0);

  // Delay the real graph response to observe the loading states.
  await page.route('**/api/graph?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Enter Frontal lobe, 3 memories' }).click();
  await expect(page.locator('.view-updating')).toHaveText('UPDATING VIEW');
  await expect(page.getByRole('region', { name: 'Topic and project clusters' })).toContainText(
    'Loading your topics…',
  );
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore #aurora, 2 memories' })).toBeVisible();
  await expect(page.locator('.view-updating')).toHaveCount(0);

  // First load: a workspace that has memories must never flash the "empty archive" onboarding.
  await page.reload();
  await expect(page.getByText('Opening your atlas…')).toBeVisible();
  await expect(page.getByText('The beginning of an archive.')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('phone portrait: bottom navigation, lobe chips and a sheet that leaves the brain in view', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const canvas = page.getByTestId('brain-viewport');
  const sheet = page.locator('.inspector');
  const dock = page.getByRole('navigation', { name: 'Workspace' });
  await expect(dock.getByRole('button')).toHaveText(['Atlas', 'Memories', 'Overview', 'New']);
  for (const box of await dock
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height)))
    expect(box).toBeGreaterThanOrEqual(44);
  // All four lobes are reachable without opening a drawer or scrolling sideways.
  const chips = await page
    .getByRole('navigation', { name: 'Cerebral lobes' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect()));
  expect(chips).toHaveLength(4);
  expect(Math.max(...chips.map((c) => c.right))).toBeLessThanOrEqual(390);
  expect(Math.min(...chips.map((c) => c.height))).toBeGreaterThanOrEqual(36);
  await expect(sheet).toBeHidden();
  const open0 = (await canvas.boundingBox())!;
  expect(open0.height).toBeGreaterThan(300);
  // Rotating the brain must not scroll or zoom the page; 16px inputs stop keyboard zoom.
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
  expect(
    await page.getByLabel('Ask your memory').evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe('16px');

  await page.getByRole('button', { name: 'Frontal lobe, 3 memories' }).click();
  await expect(sheet).toBeVisible();
  await expect(dock.getByRole('button').nth(2)).toHaveText('Lobe');
  const lobeSheet = (await sheet.boundingBox())!;
  const lobeCanvas = (await canvas.boundingBox())!;
  // The sheet covers the lower part only; the anatomy stays visible above it.
  expect(lobeSheet.y).toBeGreaterThan(280);
  expect(lobeCanvas.height).toBeGreaterThan(120);
  expect(lobeCanvas.y + lobeCanvas.height).toBeLessThanOrEqual(lobeSheet.y + 1);
  await page.getByRole('button', { name: 'Expand panel', exact: true }).click();
  expect((await sheet.boundingBox())!.y).toBeLessThan(120);
  // The bottom navigation stays reachable while the sheet is open.
  const bar = (await dock.boundingBox())!;
  const tall = (await sheet.boundingBox())!;
  expect(tall.y + tall.height).toBeLessThanOrEqual(bar.y + 1);
  await page.getByRole('button', { name: 'Shrink panel', exact: true }).click();
  expect((await sheet.boundingBox())!.y).toBeGreaterThan(280);

  await page.getByRole('button', { name: 'Explore #aurora, 2 memories' }).click();
  await topicPanel(page)
    .getByRole('button', { name: /Aurora review notes/ })
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Aurora review notes');
  // Phase 2 tabs are intact inside the sheet.
  await page.getByRole('button', { name: 'Intelligence', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Memory intelligence' })).toBeVisible();
  await page.getByRole('button', { name: /Links \(/ }).click();
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.locator('.original-content')).toContainText('review is in October');

  // Putting the sheet away keeps the selected memory; the bar brings it back.
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(depth(page)).toContainText('04 / MEMORY');
  await expect(dock.getByRole('button').nth(2)).toHaveText('Memory');
  await dock.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Aurora review notes');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.locator('.trail-back').click();
  await expect(topicPanel(page).getByRole('heading', { name: '#aurora' })).toBeVisible();
  await dock.getByRole('button', { name: 'Atlas', exact: true }).click();
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('phone landscape: side rail, side sheet and no vertical overflow', async ({ page }) => {
  const errors = pageErrors(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await open(page);
  const canvas = page.getByTestId('brain-viewport');
  const rail = (await page.getByRole('navigation', { name: 'Workspace' }).boundingBox())!;
  expect(rail.width).toBeLessThan(90);
  expect(rail.height).toBeGreaterThan(250);
  await expect(page.locator('.sidebar')).toBeHidden();
  const stage = (await canvas.boundingBox())!;
  expect(stage.width).toBeGreaterThan(400);
  expect(stage.height).toBeGreaterThan(180);
  await expect(page.getByLabel('Ask your memory')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.getByRole('button', { name: /Optical design ideas/ }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Optical design ideas');
  const sheet = (await page.locator('.inspector').boundingBox())!;
  const beside = (await canvas.boundingBox())!;
  // Context opens beside the anatomy rather than over it.
  expect(sheet.x).toBeGreaterThan(380);
  expect(sheet.height).toBeGreaterThan(300);
  expect(beside.width).toBeGreaterThan(150);
  expect(beside.x + beside.width).toBeLessThanOrEqual(sheet.x + 1);
  await expect(page.getByRole('button', { name: 'Expand panel' })).toBeHidden();
  await page.locator('.trail-back').click();
  await expect(depth(page)).toContainText('01 / WHOLE BRAIN');
  await expect(page.locator('.inspector')).toBeHidden();
  expect(errors).toEqual([]);
});

test('reduced motion: the system preference and the saved app setting both still the interface', async ({
  page,
}) => {
  await open(page);
  const motion = () =>
    page.evaluate(() => ({
      panel: getComputedStyle(document.querySelector('.inspector')!).animationName,
      halo: getComputedStyle(document.querySelector('.viewport')!, '::before').transitionDuration,
      attribute: document.querySelector('.app-shell')!.getAttribute('data-reduced-motion'),
    }));
  expect(await motion()).toEqual({ panel: 'panel-in', halo: '0.6s', attribute: null });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  expect(await motion()).toMatchObject({ panel: 'none', attribute: 'true' });
  // The saved in-app setting applies even when the system does not ask for it.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => localStorage.setItem('echo-reduced-motion', 'true'));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
  expect(await motion()).toMatchObject({ panel: 'none', attribute: 'true' });
  // Navigation still works without animation.
  await page.getByRole('button', { name: 'Enter Frontal lobe, 3 memories' }).click();
  await expect(depth(page)).toContainText('02 / LOBE');
  await page.evaluate(() => localStorage.removeItem('echo-reduced-motion'));
});

test('without WebGL every level is still reachable through the panels and trail', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).includes('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await open(page);
  await expect(page.getByText('3D view unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter Frontal lobe, 3 memories' }).click();
  await page.getByRole('button', { name: 'Explore #goals, 1 memory' }).click();
  await topicPanel(page)
    .getByRole('button', { name: /Quarterly goals/ })
    .click();
  await expect(page.locator('.original-content')).toContainText('Ship the atlas this quarter');
  await expect(depth(page)).toContainText('04 / MEMORY');
  await back(page, '#goals').click();
  await expect(topicPanel(page).getByRole('heading', { name: '#goals' })).toBeVisible();
  await page.getByRole('button', { name: 'Whole brain', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Whole brain overview' })).toBeVisible();
});
