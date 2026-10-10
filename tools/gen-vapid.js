const c = require('crypto'), j = c.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
console.log('VAPID_PUBLIC =', Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]).toString('base64url'));
console.log('VAPID_PRIVATE =', j.d);
