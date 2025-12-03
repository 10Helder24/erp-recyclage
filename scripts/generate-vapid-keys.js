// Script pour générer les clés VAPID pour les notifications push
import webpush from 'web-push';

console.log('Génération des clés VAPID pour les notifications push...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Clés VAPID générées avec succès!\n');
console.log('Ajoutez ces variables à votre fichier .env ou server/.env :\n');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('VAPID_SUBJECT=mailto:your-email@example.com\n');
console.log('Note: Remplacez your-email@example.com par votre email réel.');

