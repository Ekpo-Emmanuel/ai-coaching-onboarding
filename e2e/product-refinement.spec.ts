import { expect, test } from "@playwright/test";

test('mobile navigation closes with Escape and restores focus', async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.goto('/dev/design?screen=dashboard');
  const toggle = page.getByRole('button', {name:/Open navigation/});
  await toggle.click();
  const panel = page.getByRole('dialog', {name:'Eman Coaching'});
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', {name:'Forms',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(toggle).toBeFocused();
});

test('form management closes visibly and preserves a rename on network failure', async ({page,context})=>{
  await page.goto('/dev/design?screen=forms');
  const more=page.getByRole('button',{name:'More actions for Foundations onboarding'});
  await more.click();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect(more).toBeFocused();
  await more.click(); await page.getByRole('button',{name:'Rename',exact:true}).click();
  await page.getByLabel('Form name', {exact:true}).fill('My retained name');
  await context.setOffline(true);
  try {
    await page.getByRole('button',{name:'Save name'}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not complete');
    await expect(page.getByLabel('Form name',{exact:true})).toHaveValue('My retained name');
    await expect(page.getByRole('button',{name:'Save name'})).toBeEnabled();
  } finally {await context.setOffline(false);}
});

test('connections disclose technical details and confirm disruptive actions', async ({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto('/dev/design?screen=connections');
  await expect(page.getByText(/Coaching sends JSON/)).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Rotate secret'})).not.toBeVisible();
  await page.getByText('Manage Coaching records',{exact:true}).click();
  await page.getByRole('button',{name:'Rotate secret'}).click();
  await expect(page.getByRole('dialog')).toContainText('current secret will stop working');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByText('Signing and receiver setup',{exact:true}).click();
  await expect(page.getByText(/Coaching sends JSON/)).toBeVisible();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Disconnect Google Sheets?'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
});

test('profile keeps optional context quiet and recovers from a failed save',async({page,context})=>{
  await page.goto('/dev/design?screen=profile');
  await expect(page.getByLabel('Coaching philosophy (optional)')).not.toBeVisible();
  await page.getByText('More about your approach (optional)',{exact:true}).click();
  await page.getByLabel('Coaching philosophy (optional)').fill('Start with listening.');
  await page.getByLabel('Online',{exact:true}).check();
  await context.setOffline(true);
  try {
    await page.getByRole('button',{name:'Save profile'}).click();
    await expect(page.locator('.profile-form').getByRole('alert')).toContainText('Could not save');
    await expect(page.getByLabel('Coaching philosophy (optional)')).toHaveValue('Start with listening.');
    await expect(page.getByRole('button',{name:'Save profile'})).toBeEnabled();
  } finally {await context.setOffline(false);}
});

test('password reveal preserves the entered value',async({page})=>{
  await page.goto('/signup');
  await page.getByLabel('Password',{exact:true}).fill('SyntheticPassword123');
  await page.getByRole('button',{name:'Show password'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide password'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
  await expect(page.getByLabel('Password',{exact:true})).toHaveValue('SyntheticPassword123');
});

test('product screens fit mobile through large desktop without page errors',async({page})=>{
  test.setTimeout(600_000);
  const errors:string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  const routes=['/','/login','/signup',...['dashboard','forms','create','builder','preview','public','clients','client','submission','settings','profile','setup','connections','states'].map(screen=>'/dev/design?screen='+screen)];
  for(const route of routes){
    await page.goto(route,{timeout:60_000}); await page.locator('h1').first().waitFor();
    // Gallery chrome is not product chrome and would offset full-height workspaces.
    await page.addStyleTag({content:'.design-review-bar,nextjs-portal{display:none!important} body:has(.design-review-bar) .app-sidebar{top:0}'});
    for(const width of [320,390,768,1280,1440,1920]){
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} at ${width}px`).toBe(true);
      if([390,1440].includes(width)) await page.screenshot({path:`artifacts/refinement/after-${route.includes('screen=')?route.split('screen=')[1]:route.slice(1)||'landing'}-${width}.png`,fullPage:true});
      if(route.endsWith('screen=builder')){
        if(width<900) await page.getByRole('combobox',{name:'Workspace mode',exact:true}).selectOption('agent'); else await page.getByRole('navigation',{name:'Workspace modes'}).getByRole('button',{name:/Agent/}).click();
        const composer=page.getByLabel('Message the Agent'); await expect(composer).toBeVisible();
        const rect=await composer.boundingBox(); expect(rect!.y+rect!.height).toBeLessThanOrEqual(901);
        if(width<900) await page.getByRole('combobox',{name:'Workspace mode',exact:true}).selectOption('build'); else await page.getByRole('navigation',{name:'Workspace modes'}).getByRole('button',{name:/Build/}).click();
      }
    }
  }
  expect(errors).toEqual([]);
});

test('brief network failures offer retry without hiding original answers', async ({page})=>{
  let fail=true;
  await page.route('**/api/submissions/**/coach-brief/generate', async route=>{
    if(fail) await route.abort('failed');
    else await route.fulfill({json:{status:'complete',payload:{summary:{text:'The client wants a consistent routine.',sourceFieldKeys:['primary_goal']}}}});
  });
  await page.goto('/dev/intelligence-sandbox');
  await expect(page.getByText("Coach Brief couldn't be generated.")).toBeVisible();
  await expect(page.getByTestId('original-answer')).toBeVisible();
  fail=false; await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByText('The client wants a consistent routine.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Based on 1 answer',exact:true})).toBeVisible();
});
