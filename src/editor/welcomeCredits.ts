/** Welcome hero attribution — mirrors uikit PHOTO-CREDITS / kit credits.ts (c18 only). */

export interface WelcomeCredit {
  id: string
  title: string
  author: string
  url: string
  license: string
}

export const LICENSE_URL: Record<string, string> = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
}

export const WELCOME_CREDITS: Record<string, WelcomeCredit> = {
  c18: {
    id: 'c18',
    title: 'Dülmen, Leuste, Bäume im Nebel -- 2020 -- 5042 (bw)',
    author: 'Dietmar Rabich',
    url: 'https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Leuste,_B%C3%A4ume_im_Nebel_--_2020_--_5042_(bw).jpg',
    license: 'CC BY-SA 4.0',
  },
}

/** Public path for the welcome hero (also referenced from WelcomeScreen.css). */
export const WELCOME_HERO_SRC = '/photos/hi/c18.jpg'
