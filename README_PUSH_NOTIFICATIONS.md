# Configuration des Notifications Push

## Génération des clés VAPID

1. Exécutez la commande suivante pour générer les clés VAPID :

```bash
npm run generate-vapid-keys
```

2. Les clés générées s'affichent dans la console. Copiez-les et ajoutez-les à votre fichier `.env` à la racine du projet :

```env
VAPID_PUBLIC_KEY=BBKG7F0eaCvinRJhBfxKK4zVH0k1XiUjs924qT_KOvlV8VvHJXkMSoo4_puRO6FF2U_fZ3m_k4RRj1HyyYPIIKY
VAPID_PRIVATE_KEY=QBfzguvnHzVL5tV_yMjU3vQ3rfJO_-rX0nlH0xBBeJA
VAPID_SUBJECT=mailto:votre-email@example.com
```

**Important** : 
- Remplacez `votre-email@example.com` par votre email réel (ex: `mailto:admin@retripa.com`)
- Ne partagez JAMAIS votre clé privée VAPID
- La clé publique peut être partagée (elle est envoyée au client)
- Le fichier `.env` a été créé automatiquement avec les clés générées
- Si vous régénérez les clés, mettez à jour le fichier `.env`

## Fonctionnement

### Côté Client (Frontend)
- Lors du chargement de la page mobile, le système demande automatiquement la permission pour les notifications
- La clé publique VAPID est récupérée depuis le serveur
- Une subscription Push est créée et enregistrée sur le serveur

### Côté Serveur (Backend)
- Les clés VAPID sont chargées depuis les variables d'environnement
- Les tokens de subscription sont stockés dans la table `push_notification_tokens`
- Lorsqu'une intervention est créée ou assignée, une notification est automatiquement envoyée

## Envoi de notifications

### Automatique
Les notifications sont automatiquement envoyées lorsque :
- Une nouvelle intervention est créée et assignée à un opérateur
- Une intervention existante est assignée à un opérateur

### Manuel
Vous pouvez envoyer une notification manuellement via l'API :

```typescript
await Api.sendPushNotification({
  employee_id: 'uuid-de-l-employe',
  title: 'Titre de la notification',
  body: 'Corps de la notification',
  data: { intervention_id: 'uuid' },
  url: '/?page=mobile'
});
```

## Test des notifications

1. Assurez-vous que les clés VAPID sont configurées
2. Ouvrez la page mobile sur un appareil ou navigateur compatible
3. Acceptez la permission pour les notifications
4. Créez une intervention et assignez-la à un opérateur
5. Une notification devrait apparaître sur l'appareil de l'opérateur

## Compatibilité

- ✅ Chrome/Edge (Desktop et Mobile)
- ✅ Firefox (Desktop et Mobile)
- ✅ Safari (macOS et iOS) - nécessite HTTPS
- ⚠️ Les notifications push nécessitent HTTPS en production (sauf localhost)

## Dépannage

### Les notifications ne fonctionnent pas
1. Vérifiez que les clés VAPID sont bien configurées dans `.env`
2. Vérifiez que le Service Worker est enregistré (console du navigateur)
3. Vérifiez que la permission de notification est accordée
4. Vérifiez les logs du serveur pour les erreurs

### Erreur "Notifications push non configurées"
- Les clés VAPID ne sont pas définies dans les variables d'environnement
- Exécutez `npm run generate-vapid-keys` et ajoutez les clés au `.env`

### Les tokens sont désactivés automatiquement
- Cela signifie que le token est invalide ou expiré
- L'utilisateur devra réaccepter les notifications pour obtenir un nouveau token

