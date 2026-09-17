/**
 * Tính số tiền Sàn (Hệ thống) nhận từ phí vận chuyển dựa theo quãng đường và khung giờ
 * @param distanceKm Quãng đường giao hàng (km)
 * @param createdAt Date hoặc ISO String thời gian tạo đơn
 */
export function calculatePlatformShippingShare(distanceKm: number, createdAt?: string | Date): number {
  let baseSystemFee = 0;
  const km = Number(distanceKm || 0);

  // 1. Phân bổ theo Quãng đường (Km)
  if (km <= 1) {
    baseSystemFee = 2000;
  } else if (km > 1 && km <= 2) {
    baseSystemFee = 3000;
  } else if (km > 2 && km <= 3) {
    baseSystemFee = 4000;
  } else if (km > 3 && km <= 4) {
    baseSystemFee = 4500;
  } else if (km > 4 && km <= 5) {
    baseSystemFee = 5000;
  } else {
    // > 5km: Mỗi km tiếp theo tăng thêm (ví dụ lấy mốc từ 5km là 5500)
    baseSystemFee = 5500;
  }

  // 2. Phụ thu theo Khung giờ cao điểm
  let surgeFee = 0;
  if (createdAt) {
    const date = new Date(createdAt);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Khung 11:00 - 12:30 (660 - 750 phút) -> Sàn nhận +500đ
    if (timeInMinutes >= 660 && timeInMinutes <= 750) {
      surgeFee = 500;
    }
    // Khung 18:00 - 19:59 (1080 - 1199 phút) -> Sàn nhận +1500đ
    else if (timeInMinutes >= 1080 && timeInMinutes <= 1199) {
      surgeFee = 1500;
    }
    // Khung 20:00 - 00:00 (1200 - 1439 phút) -> Sàn nhận +2500đ
    else if (timeInMinutes >= 1200 && timeInMinutes <= 1439) {
      surgeFee = 2500;
    }
  }

  return baseSystemFee + surgeFee;
}