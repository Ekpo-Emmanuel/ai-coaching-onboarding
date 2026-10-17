import {expect,test} from '@playwright/test';

test('forms actions use one mobile menu and filters remain useful',async({page})=>{
  await page.setViewportSize({width:320,height:844});
  await page.goto('/dev/design?screen=forms');
  await expect(page.getByRole('link',{name:'Create onboarding form'})).toBeVisible();
  await expect(page.locator('.form-manage-actions').getByRole('button',{name:'Publish',exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'More actions for Online coaching · First steps'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Publish',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Delete',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('navigation',{name:'Filter forms'}).getByRole('link',{name:'Archived'}).click();
  await expect(page.getByRole('heading',{name:'No archived forms'})).toBeVisible();
  await page.getByRole('link',{name:'Show active forms'}).click();
  await expect(page.locator('.form-manage-row')).toHaveCount(2);
});

test('question editing discloses relevant controls and supports direct reordering',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dev/design?screen=builder');
  await context.setOffline(true);
  try {
    await page.locator('.bw-section-row').first().click();
    await page.getByRole('button',{name:/1 Full name/}).click();
    await expect(page.getByLabel('Answer key',{exact:true})).not.toBeVisible();
    await expect(page.getByRole('combobox',{name:'Question position',exact:true})).not.toBeVisible();
    await page.getByRole('combobox',{name:'Answer type',exact:true}).selectOption('single_select');
    await expect(page.getByRole('group',{name:'Answer choices'})).toBeVisible();
    await page.getByText('Helper text and answer guidance',{exact:true}).click();
    await expect(page.getByLabel('Placeholder example',{exact:true})).not.toBeVisible();
    await page.getByRole('combobox',{name:'Answer type',exact:true}).selectOption('scale');
    await expect(page.getByLabel('Lowest number',{exact:true})).toBeVisible();
    await expect(page.getByRole('group',{name:'Answer choices'})).not.toBeVisible();
    await page.getByRole('combobox',{name:'Answer type',exact:true}).selectOption('short_text');
    await page.getByText('Manage question',{exact:true}).click();
    await page.getByRole('combobox',{name:'Question position',exact:true}).selectOption('1');
    await expect(page.getByRole('combobox',{name:'Question position',exact:true})).toHaveValue('1');
    await page.screenshot({path:'artifacts/creation/question-390.png',fullPage:true});
    await page.getByRole('button',{name:'Done editing'}).click();
    await expect(page.locator('.bw-question-row').first()).toContainText('Email');
    await expect(page.locator('.bw-question-row').nth(1)).toContainText('Full name');
  } finally {await context.setOffline(false);}
});

test('builder tools reveal focused settings and rules without duplicate toolbars',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/dev/design?screen=builder');
  expect((await page.locator('.bw-header').boundingBox())!.height).toBeLessThanOrEqual(58);
  const tools=page.getByRole('button',{name:'Form tools',exact:true});
  await tools.click();
  await expect(page.getByRole('menu',{name:'Form tools'})).toBeVisible();
  await page.getByRole('menuitem',{name:'Form settings'}).click();
  await expect(page.getByLabel('Form name',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Intro title',{exact:true})).not.toBeVisible();
  await page.getByText('Welcome screen',{exact:true}).click();
  await expect(page.getByLabel('Intro title',{exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/creation/settings-390.png',fullPage:true});
  await tools.click(); await page.keyboard.press('Escape'); await expect(tools).toBeFocused();
  await tools.click(); await page.getByRole('menuitem',{name:'Review rules'}).click();
  await expect(page.getByRole('heading',{name:'Review rules',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'All sections'}).click();
  await expect(page.getByRole('heading',{name:'Form structure'})).toBeVisible();
});
