
export interface Project {
  id: string;
  title: string;
  category: string;
  year: string;
  image: string;
  description: string;
}

export enum SectionID {
  HOME = 'home',
  WORK = 'work',
  ABOUT = 'about',
  CONTACT = 'contact'
}
