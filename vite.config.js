import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  build: { rolldownOptions: { input: { main: 'index.html', cube: 'cube.html', image: 'image.html', colony: 'colony.html', atelier: 'atelier.html', bobines: 'bobines.html', escapade: 'escapade.html', passages:'passages.html', voyage:'voyage.html', carrousel:'carrousel.html', broderie:'broderie.html', alveoles:'alveoles.html', potions:'potions.html', liaisons:'liaisons.html', noeuds:'noeuds.html', gouttes:'gouttes.html', ecluses:'ecluses.html', dunes:'dunes.html', fringale:'fringale.html', recolte:'recolte.html', dizaines:'dizaines.html', mosaique:'mosaique.html', etageres:'etageres.html', duos:'duos.html', terriers:'terriers.html', ruisseaux:'ruisseaux.html', balancier:'balancier.html', gelees:'gelees.html', plis:'plis.html', lucioles:'lucioles.html', aiguillages:'aiguillages.html', valises:'valises.html', sangles:'sangles.html', traces:'traces.html', bascules:'bascules.html', sillons:'sillons.html', raccords:'raccords.html' } } },
});
