import {expect,test,type Page} from '@playwright/test';
async function selectMode(page:Page,value:string){const select=page.getByRole('combobox',{name:'Workspace mode',exact:true});if(await select.isVisible())await select.selectOption(value);else await page.getByRole('navigation',{name:'Workspace modes'}).getByRole('button',{name:new RegExp('^'+value+'$','i')}).click();}
test('focused Builder modes fit phones through desktops',async({page})=>{
 test.setTimeout(180_000);
 await page.goto('/dev/design?screen=builder');
 await page.addStyleTag({content:'.design-review-bar,nextjs-portal{display:none!important}'});
 for(const width of [320,390,430,768,1024,1440,1920]){
  await page.setViewportSize({width,height:844});
  await selectMode(page,'build');
  expect((await page.locator('.bw-header').boundingBox())!.height).toBeLessThanOrEqual(58);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.bw-section-row')).toHaveCount(3);
  await expect(page.locator('.bw-question-row')).toHaveCount(0);
  await page.screenshot({path:`artifacts/mobile-builder/structure-${width}.png`});
  await page.locator('.bw-section-row').first().click();
  await expect(page.getByRole('heading',{name:'About you',exact:true})).toBeFocused();
  await expect(page.locator('.bw-question-row')).toHaveCount(2);
  await page.locator('.bw-question-row').first().click();
  await expect(page.getByRole('heading',{name:'Edit question',exact:true})).toBeFocused();
  await expect(page.locator('.bw-section-row')).toHaveCount(0);
  await page.getByRole('button',{name:'Done editing'}).click();
  await page.getByRole('button',{name:'All sections'}).click();
  await selectMode(page,'agent');
  const composer=page.getByRole('textbox',{name:'Message the Agent',exact:true});
  await expect(composer).toBeVisible();
  const bounds=await composer.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({path:`artifacts/mobile-builder/agent-${width}.png`});
  await selectMode(page,'preview');
  await expect(page.getByText('Nothing is submitted.',{exact:true})).toBeVisible();
  await expect(page.locator('.preview-frame')).toBeVisible();
  if(width<680){await expect(page.getByRole('group',{name:'Preview viewport'})).not.toBeVisible();expect((await page.locator('.preview-frame').boundingBox())!.y).toBeLessThan(110);}
  await page.screenshot({path:`artifacts/mobile-builder/preview-${width}.png`});
 }
});
test('phone publish stays separate from modes and tools recover focus',async({page})=>{
 await page.setViewportSize({width:320,height:640});await page.goto('/dev/design?screen=builder');
 await expect(page.getByRole('button',{name:'Publish',exact:true})).not.toBeVisible();
 const tools=page.getByRole('button',{name:'Form tools',exact:true});await tools.click();
 await page.getByRole('menuitem',{name:'Publish',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('save your draft');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await tools.click();await page.keyboard.press('Escape');await expect(tools).toBeFocused();
});
test('large forms stay compact and long titles preserve navigation',async({page})=>{
 await page.setViewportSize({width:320,height:640});await page.goto('/dev/design?screen=builder&state=large');
 await page.addStyleTag({content:'.design-review-bar,nextjs-portal{display:none!important}'});
 await expect(page.getByText('10 sections · 83 questions',{exact:true})).toBeVisible();
 await expect(page.locator('.bw-section-row')).toHaveCount(10);
 await expect(page.locator('.bw-question-row')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.bw-section-row').last().click();
 await expect(page.locator('.bw-question-row')).toHaveCount(8);
 await page.screenshot({path:'artifacts/mobile-builder/large-section-320.png'});
 await selectMode(page,'agent');
 await page.setViewportSize({width:320,height:380});
 const composer=await page.getByRole('textbox',{name:'Message the Agent',exact:true}).boundingBox();
 expect(composer!.y+composer!.height).toBeLessThanOrEqual(380);
 await page.setViewportSize({width:1440,height:900});
 await expect(page.getByRole('combobox',{name:'Workspace mode',exact:true})).not.toBeVisible();
 await selectMode(page,'preview');
 await page.getByRole('button',{name:'Desktop',exact:true}).click();
 expect((await page.locator('.preview-frame').boundingBox())!.width).toBeGreaterThan(900);
 await page.screenshot({path:'artifacts/mobile-builder/desktop-preview-1440.png'});
});
