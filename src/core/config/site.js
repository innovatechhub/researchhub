export const site = {
  name: 'ResearchHub BNHS',
  school: 'Barbaza National High School',
  location: 'Barbaza, Antique, Philippines',
  email: import.meta.env.VITE_SCHOOL_CONTACT_EMAIL || '',
  // A single image from VITE_SCHOOL_HERO_IMAGE replaces the campus slideshow.
  heroImages: import.meta.env.VITE_SCHOOL_HERO_IMAGE
    ? [import.meta.env.VITE_SCHOOL_HERO_IMAGE]
    : [
        '/brand/hero-campus-1.jpg',
        '/brand/hero-campus-2.jpg',
        '/brand/hero-campus-3.jpg',
        '/brand/hero-campus-4.jpg',
        '/brand/hero-campus-5.jpg'
      ],
  // Barbaza National High School seal. The previous ResearchHub mark is still at
  // /brand/researchhub-bnhs-logo.jpg if you want to switch back.
  logo: '/brand/bnhs-seal.png'
};
