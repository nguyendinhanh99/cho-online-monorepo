importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyA59c7zMb7TBWSzJR3A5EYPNrAs26Lr8dk",
  authDomain: "nishop-de3c5.firebaseapp.com",
  projectId: "nishop-de3c5",
  storageBucket: "nishop-de3c5.appspot.com",
  messagingSenderId: "787097599981",
  appId: "1:787097599981:web:1ef33377a8bb4aac2db1e4"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Xử lý thông báo chạy ngầm (Background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Nhận thông báo ngầm: ', payload);

  const notificationTitle = payload.notification?.title || 'Có đơn hàng mới!';
  const notificationOptions = {
    body: payload.notification?.body || 'Bạn vừa nhận được một đơn hàng mới.',
    icon: '/file.svg',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});