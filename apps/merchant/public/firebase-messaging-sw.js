importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

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

// 🔔 Sự kiện chạy ngầm khi đóng/tắt tab web
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Nhận tin nhắn ngầm:", payload);

  const notificationTitle = payload.notification?.title || "Đơn hàng mới!";
  const notificationOptions = {
    body: payload.notification?.body || "Bạn có đơn hàng mới vừa nhận.",
    icon: "/file.svg",
    // 🔊 Bắt buộc bật silent: false để hệ điều hành phát chuông báo hệ thống
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});