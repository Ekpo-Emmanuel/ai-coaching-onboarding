import { expect, test } from '@playwright/test';

test('navigation adapts without duplicate chrome and keeps destinations and sign out reachable', async ({page}) => {
  test.setTimeout(180_000);
  await page.goto('/dev/design?screen=connections');
  await page.addStyleTag({content:'.design-review-bar,nextjs-portal{display:none!important}body:has(.design-review-bar) .app-sidebar{top:0}'});
  for (const width of [320,390,430,768,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('.workspace-topbar')).toHaveCount(0);
    if(width<768) {
      const trigger=page.getByRole('button',{name:/Open navigation/});
      await expect(trigger).toBeVisible();
      await page.screenshot({path:`artifacts/navigation/closed-${width}.png`,fullPage:true});
      await trigger.click();
      const dialog=page.getByRole('dialog',{name:'Eman Coaching'});
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link',{name:'Connections Current',exact:true})).toHaveAttribute('aria-current','page');
      await expect(dialog.getByRole('link',{name:'Settings',exact:true})).toBeVisible();
      await expect(dialog.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
      await page.screenshot({path:`artifacts/navigation/open-${width}.png`});
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(dialog).not.toBeVisible();
    } else {
      await expect(page.locator('.app-sidebar')).toBeVisible();
      await expect(page.locator('.mobile-header')).not.toBeVisible();
      const current=page.locator('.app-nav [aria-current=page]');
      await expect(current).toHaveText('Connections');
      const account=page.getByRole('button',{name:'Account for Eman Coaching'});
      await account.click();
      await expect(page.getByRole('menuitem',{name:'Sign out'})).toBeVisible();
      await page.keyboard.press('End');
      await expect(page.getByRole('menuitem',{name:'Sign out'})).toBeFocused();
      await page.screenshot({path:`artifacts/navigation/account-${width}.png`});
      await page.keyboard.press('Escape');
      await expect(account).toBeFocused();
      await page.screenshot({path:`artifacts/navigation/closed-${width}.png`});
    }
  }
});

test('mobile navigation traps focus, closes on resize, and supports short screens',async({page})=>{
  await page.setViewportSize({width:320,height:480});
  await page.goto('/dev/design?screen=profile');
  const toggle=page.getByRole('button',{name:/Open navigation/});
  await toggle.click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Sign out',exact:true}).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Close navigation'})).toBeFocused();
  await expect(dialog.locator('[aria-current=page]')).toHaveText('SettingsCurrent');
  await page.setViewportSize({width:768,height:600});
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  await page.setViewportSize({width:390,height:844});
  await toggle.click();
  await dialog.getByRole('button',{name:'Close navigation'}).click();
  await expect(toggle).toBeFocused();
});

test('builder has only focused workspace navigation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dev/design?screen=builder');
  await expect(page.locator('.app-sidebar')).toHaveCount(0);
  await expect(page.locator('.mobile-header')).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Workspace mode',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Forms/})).toBeVisible();
});

test('sign out keeps its existing request and retry behavior on mobile and desktop',async({page})=>{
  let fail=true;
  await page.route('**/api/auth/sign-out',async route=>{
    if(fail) await route.fulfill({status:500,json:{message:'Synthetic failure'}});
    else await route.fulfill({json:{success:true}});
  });
  for(const width of [390,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/dev/design?screen=dashboard');
    await page.getByRole('button',{name:width<768?/Open navigation/:/Account for/}).click();
    const surface=width<768?page.getByRole('dialog'):page.getByRole('menu',{name:'Account'});
    const signout=surface.getByRole(width<768?'button':'menuitem',{name:'Sign out',exact:true});
    fail=true; await signout.click();
    await expect(surface.getByRole('alert')).toHaveText('Could not sign out. Please try again.');
    await expect(signout).toBeEnabled();
    fail=false; await signout.click();
    await expect(page).toHaveURL(/\/login/);
  }
});

test('parent destinations remain current across authenticated screen patterns',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  for(const [screen,label] of [['dashboard','Dashboard'],['forms','Forms'],['create','Forms'],['clients','Clients'],['client','Clients'],['submission','Clients'],['settings','Settings'],['profile','Settings'],['connections','Connections']]) {
    await page.goto('/dev/design?screen='+screen);
    await expect(page.locator('.app-nav [aria-current=page]')).toHaveText(label);
  }
});
