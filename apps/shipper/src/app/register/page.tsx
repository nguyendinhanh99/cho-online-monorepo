"use client";

import { useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { createUserWithEmailAndPassword } from "firebase/auth";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

const CLOUD_NAME = "lfqjrcvh";

const UPLOAD_PRESET = "ml_default";

const SHIPPER_AGREEMENT_VERSION = "SHIPPER_TRIAL_2026_V1";

const SHIPPER_AGREEMENT_TITLE =
  "Thỏa thuận hợp tác đối tác Shipper Anvami - Giai đoạn thử nghiệm";

const SHIPPER_AGREEMENT_SUMMARY = [
  {
    title: "1. Hình thức hợp tác",
    content:
      "Bạn tham gia với tư cách đối tác shipper trong giai đoạn Anvami đang thử nghiệm. Bạn có quyền chủ động nhận hoặc từ chối đơn; khi đã xác nhận nhận đơn, bạn có trách nhiệm thực hiện đúng quy trình và hoàn tất đơn trong khả năng hợp lý.",
  },
  {
    title: "2. Ký quỹ bảo đảm",
    content:
      "Khoản ký quỹ là 1.500.000đ, không phải phí tham gia hay doanh thu của Anvami. Khi chấm dứt hợp tác và đã hoàn tất đơn hàng, đối soát, bàn giao tiền/hàng/tài sản và không còn nghĩa vụ hợp lệ, khoản ký quỹ được hoàn lại trong vòng 07 ngày làm việc. Chỉ được cấn trừ khi có căn cứ và đối soát rõ ràng.",
  },
  {
    title: "3. Nhận đơn, COD và giao hàng",
    content:
      "Bạn chỉ nhận đơn khi có khả năng thực hiện. Đơn COD phải thu đúng số tiền hiển thị; tiền COD phải được quản lý riêng và bàn giao/đối soát theo quy trình. Không tự ý giữ hàng, hủy đơn, giao sai người hoặc thu thêm ngoài số tiền hợp lệ của đơn.",
  },
  {
    title: "4. Thu nhập và phí giao hàng",
    content:
      "Phí giao hàng khách trả (shippingFee) và thu nhập của shipper là hai khoản độc lập. Voucher hoặc trợ giá cho khách không mặc nhiên làm giảm thu nhập shipper, trừ khi chương trình có quy định rõ và được thông báo trước.",
  },
  {
    title: "5. Hàng hóa và hoàn hàng",
    content:
      "Bạn có trách nhiệm bảo quản hàng hóa trong quá trình nhận, giao và hoàn. Nếu làm mất, tráo đổi hoặc làm hư hỏng do lỗi của mình, bạn chịu trách nhiệm trong phạm vi thiệt hại có căn cứ. Không tự ý sử dụng, bán, tiêu hủy hoặc chuyển giao hàng cho người khác.",
  },
  {
    title: "6. An toàn, dữ liệu và hành vi bị cấm",
    content:
      "Bạn phải tuân thủ pháp luật giao thông, giấy tờ phương tiện và các yêu cầu an toàn. Không sử dụng rượu bia/chất kích thích trái pháp luật khi giao hàng; không giả mạo trạng thái, vị trí, tạo đơn giả, thông đồng hoặc lợi dụng voucher. Dữ liệu khách hàng chỉ được sử dụng để thực hiện đơn hàng.",
  },
  {
    title: "7. Đối soát, thuế và thay đổi chính sách",
    content:
      "Thu nhập được đối soát theo đơn hoàn tất, bảng cước, phụ phí, thưởng và các điều chỉnh hợp lệ. Shipper tự thực hiện nghĩa vụ thuế cá nhân, trừ trường hợp pháp luật yêu cầu Anvami khấu trừ/kê khai/nộp thay. Những thay đổi quan trọng ảnh hưởng đến thu nhập hoặc nghĩa vụ tài chính sẽ được thông báo trước khi áp dụng trong phạm vi pháp luật cho phép.",
  },
  {
    title: "8. Chấm dứt hợp tác và tranh chấp",
    content:
      "Mỗi bên có thể chấm dứt hợp tác với thông báo trước ít nhất 07 ngày, trừ vi phạm nghiêm trọng hoặc trường hợp pháp luật cho phép chấm dứt ngay. Trước khi kết thúc, shipper phải hoàn tất/bàn giao các đơn, COD, hàng hóa và tài sản còn giữ. Tranh chấp được ưu tiên thương lượng, nếu không thành sẽ giải quyết tại cơ quan có thẩm quyền theo pháp luật Việt Nam.",
  },
] as const;

interface ModalState {

  isOpen: boolean;

  type: "success" | "error" | "warning";

  title: string;

  message: string;

  actionText?: string;

  onAction?: () => void;

}

export default function ShipperRegisterPage() {

  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  const [uploadStatus, setUploadStatus] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [hasAcceptedAgreement, setHasAcceptedAgreement] = useState(false);

  const [showAgreementModal, setShowAgreementModal] = useState(false);

  // Custom Modal Alert State

  const [modal, setModal] = useState<ModalState>({

    isOpen: false,

    type: "error",

    title: "",

    message: "",

  });

  // Form State

  const [formData, setFormData] = useState({

    fullName: "",

    phone: "",

    password: "",

    identityCardNumber: "",

    licensePlate: "",

    vehicleType: "MOTORBIKE",

  });

  const [files, setFiles] = useState<{

    avatar: File | null;

    idFront: File | null;

    idBack: File | null;

    driverLicense: File | null;

  }>({

    avatar: null,

    idFront: null,

    idBack: null,

    driverLicense: null,

  });

  const [previews, setPreviews] = useState({

    avatar: "",

    idFront: "",

    idBack: "",

    driverLicense: "",

  });

  // Hàm kiểm tra định dạng mật khẩu mạnh

  const validatePassword = (password: string): boolean => {

    // Tối thiểu 6 ký tự, ít nhất 1 chữ cái, 1 số và 1 ký tự đặc biệt

    const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

    return strongPasswordRegex.test(password);

  };

  const handleFileChange = (

    e: React.ChangeEvent<HTMLInputElement>,

    field: keyof typeof files

  ) => {

    const file = e.target.files?.[0];

    if (file) {

      setFiles((prev) => ({ ...prev, [field]: file }));

      if (previews[field]) URL.revokeObjectURL(previews[field]);

      setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));

    }

  };

  const uploadToCloudinary = async (file: File): Promise<string> => {

    const data = new FormData();

    data.append("file", file);

    data.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(

      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,

      { method: "POST", body: data }

    );

    if (!res.ok) throw new Error("Lỗi khi tải ảnh lên Cloudinary");

    const result = await res.json();

    return result.secure_url;

  };

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    // 1. Validate mật khẩu mạnh

    if (!validatePassword(formData.password)) {

      setModal({

        isOpen: true,

        type: "warning",

        title: "Mật khẩu chưa đủ mạnh",

        message:

          "Mật khẩu phải dài ít nhất 6 ký tự, bao gồm cả chữ cái, chữ số và ít nhất 1 ký tự đặc biệt (ví dụ: @, #, $, !...).",

      });

      return;

    }

    // 2. Bắt buộc đồng ý thỏa thuận hợp tác

    if (!hasAcceptedAgreement) {

      setModal({

        isOpen: true,

        type: "warning",

        title: "Bạn chưa đồng ý thỏa thuận",

        message:
          "Vui lòng đọc và xác nhận Thỏa thuận hợp tác đối tác Shipper Anvami trước khi nộp hồ sơ.",

      });

      return;

    }

    // 3. Validate giấy tờ

    if (!files.avatar || !files.idFront || !files.idBack || !files.driverLicense) {

      setModal({

        isOpen: true,

        type: "warning",

        title: "Thiếu thông tin giấy tờ",

        message: "Vui lòng tải lên đầy đủ: Ảnh đại diện, CCCD (2 mặt) và Bằng lái xe trước khi tiếp tục!",

      });

      return;

    }

    setIsLoading(true);

    try {

      setUploadStatus("Đang tải ảnh giấy tờ lên Cloudinary...");

      const [avatarUrl, idFrontUrl, idBackUrl, driverLicenseUrl] = await Promise.all([

        uploadToCloudinary(files.avatar),

        uploadToCloudinary(files.idFront),

        uploadToCloudinary(files.idBack),

        uploadToCloudinary(files.driverLicense),

      ]);

      setUploadStatus("Đang tạo tài khoản Firebase...");

      const cleanPhone = formData.phone.trim().replace(/\s+/g, "");

      const virtualEmail = `${cleanPhone}@shipper.choonline.vn`;

      const userCredential = await createUserWithEmailAndPassword(

        auth,

        virtualEmail,

        formData.password

      );

      const uid = userCredential.user.uid;

      setUploadStatus("Đang lưu thông tin hồ sơ...");

      await setDoc(doc(db, "shippers", uid), {

        uid,

        fullName: formData.fullName.trim(),

        phone: cleanPhone,

        identityCardNumber: formData.identityCardNumber.trim(),

        licensePlate: formData.licensePlate.trim(),

        vehicleType: formData.vehicleType,

        avatarUrl,

        idCardFrontUrl: idFrontUrl,

        idCardBackUrl: idBackUrl,

        driverLicenseUrl,

        status: "PENDING_APPROVAL",

        agreementAccepted: true,

        agreementVersion: SHIPPER_AGREEMENT_VERSION,

        agreementTitle: SHIPPER_AGREEMENT_TITLE,

        agreementAcceptedAt: serverTimestamp(),

        createdAt: new Date().toISOString(),

      });

      setIsLoading(false);

      setModal({

        isOpen: true,

        type: "success",

        title: "Nộp hồ sơ thành công! 🎉",

        message: "Hồ sơ của bạn đã được ghi nhận. Hệ thống sẽ kiểm tra và duyệt trong vòng 24 giờ.",

        actionText: "Đến trang chờ duyệt",

        onAction: () => router.push("/pending"),

      });

    } catch (error: any) {

      setIsLoading(false);

      console.error("Lỗi đăng ký:", error);

      if (error.code === "auth/email-already-in-use") {

        setModal({

          isOpen: true,

          type: "warning",

          title: "Số điện thoại đã tồn tại",

          message: "Số điện thoại này đã được đăng ký tài khoản shipper trước đó. Bạn có muốn chuyển sang đăng nhập?",

          actionText: "Đăng nhập ngay",

          onAction: () => router.push("/login"),

        });

      } else {

        setModal({

          isOpen: true,

          type: "error",

          title: "Đăng ký thất bại",

          message: error.message || "Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.",

        });

      }

    }

  };

  return (

    <main className="min-h-screen bg-stone-100 py-6 px-4 font-sans flex justify-center items-center relative">

      <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 space-y-6">

        <div className="text-center space-y-1">

          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto shadow-sm">

            🪪

          </div>

          <h1 className="text-lg font-black text-stone-800">Đăng Ký Tài Xế & Xác Minh Hồ Sơ</h1>

          <p className="text-xs text-stone-400">

            Điền đúng thông tin và chụp rõ nét giấy tờ để được duyệt trong 24h

          </p>

        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">

          {/* 1. THÔNG TIN CÁ NHÂN */}

          <div className="space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">

            <h3 className="font-extrabold text-stone-700 uppercase text-[10px] tracking-wider">

              1\. Thông tin cá nhân & Đăng nhập

            </h3>

            <div>

              <label className="block font-bold text-stone-600 mb-1">Họ và tên tài xế *</label>

              <input

                type="text"

                required

                placeholder="Nguyễn Văn A"

                value={formData.fullName}

                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}

                className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500 transition-all"

              />

            </div>

            <div className="grid grid-cols-2 gap-2">

              <div>

                <label className="block font-bold text-stone-600 mb-1">Số điện thoại *</label>

                <input

                  type="tel"

                  required

                  placeholder="0901234567"

                  value={formData.phone}

                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}

                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500 transition-all"

                />

              </div>

              {/* Ô Nhập Mật Khẩu có Toggle Xem Mật Khẩu */}

              <div>

                <label className="block font-bold text-stone-600 mb-1">Mật khẩu *</label>

                <div className="relative">

                  <input

                    type={showPassword ? "text" : "password"}

                    required

                    placeholder="Ví dụ: Pass@123"

                    value={formData.password}

                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}

                    className="w-full bg-white border border-stone-200 rounded-xl p-2.5 pr-9 text-stone-800 focus:outline-none focus:border-blue-500 transition-all"

                  />

                  <button

                    type="button"

                    onClick={() => setShowPassword(!showPassword)}

                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold p-1 focus:outline-none select-none"

                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}

                  >

                    {showPassword ? "🙈" : "👁️"}

                  </button>

                </div>

              </div>

            </div>

            <p className="text-[10px] text-stone-400 italic">

              * Mật khẩu phải gồm ít nhất 6 ký tự: chứa cả chữ, số và ký tự đặc biệt (VD: @, #, !).

            </p>

          </div>

          {/* 2. THÔNG TIN PHƯƠNG TIỆN */}

          <div className="space-y-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">

            <h3 className="font-extrabold text-stone-700 uppercase text-[10px] tracking-wider">

              2\. Thông tin Phương tiện & CCCD

            </h3>

            <div className="grid grid-cols-2 gap-2">

              <div>

                <label className="block font-bold text-stone-600 mb-1">Số CCCD *</label>

                <input

                  type="text"

                  required

                  placeholder="048099XXXXXX"

                  value={formData.identityCardNumber}

                  onChange={(e) => setFormData({ ...formData, identityCardNumber: e.target.value })}

                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500 transition-all"

                />

              </div>

              <div>

                <label className="block font-bold text-stone-600 mb-1">Biển số xe *</label>

                <input

                  type="text"

                  required

                  placeholder="43-F1 123.45"

                  value={formData.licensePlate}

                  onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}

                  className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:border-blue-500 transition-all"

                />

              </div>

            </div>

          </div>

          {/* 3. TẢI ẢNH GIẤY TỜ */}

          <div className="space-y-3 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/60">

            <h3 className="font-extrabold text-blue-900 uppercase text-[10px] tracking-wider">

              3\. Tải lên giấy tờ xác minh (Upload qua Cloudinary)

            </h3>

            <div>

              <label className="block font-bold text-stone-700 mb-1">Ảnh chân dung *</label>

              <div className="flex items-center gap-3">

                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) => handleFileChange(e, "avatar")}

                  className="text-[11px] text-stone-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer"

                />

                {previews.avatar && (

                  <img src={previews.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-xs" />

                )}

              </div>

            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">

              <div>

                <label className="block font-bold text-stone-700 mb-1">CCCD Mặt Trước *</label>

                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) => handleFileChange(e, "idFront")}

                  className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold cursor-pointer"

                />

                {previews.idFront && (

                  <img src={previews.idFront} alt="CCCD Truoc" className="mt-1.5 h-16 w-full rounded-lg object-cover border shadow-xs" />

                )}

              </div>

              <div>

                <label className="block font-bold text-stone-700 mb-1">CCCD Mặt Sau *</label>

                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) => handleFileChange(e, "idBack")}

                  className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold cursor-pointer"

                />

                {previews.idBack && (

                  <img src={previews.idBack} alt="CCCD Sau" className="mt-1.5 h-16 w-full rounded-lg object-cover border shadow-xs" />

                )}

              </div>

            </div>

            <div className="pt-1">

              <label className="block font-bold text-stone-700 mb-1">Ảnh Bằng Lái Xe *</label>

              <input

                type="file"

                accept="image/*"

                onChange={(e) => handleFileChange(e, "driverLicense")}

                className="w-full text-[10px] text-stone-500 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-stone-200 file:font-bold cursor-pointer"

              />

              {previews.driverLicense && (

                <img src={previews.driverLicense} alt="Bang Lai" className="mt-1.5 h-20 w-full rounded-lg object-cover border shadow-xs" />

              )}

            </div>

          </div>

          {/* 4. THỎA THUẬN HỢP TÁC */}

          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">

            <div className="flex items-start justify-between gap-3">

              <div>

                <h3 className="font-extrabold text-emerald-900 uppercase text-[10px] tracking-wider">

                  4. Thỏa thuận hợp tác Shipper

                </h3>

                <p className="mt-1 text-[10px] leading-4 text-emerald-800/80">

                  Bản tóm tắt các nội dung quan trọng trước khi bạn gửi hồ sơ đăng ký.

                </p>

              </div>

              <button

                type="button"

                onClick={() => setShowAgreementModal(true)}

                className="shrink-0 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"

              >

                Xem nội dung

              </button>

            </div>

            <div className="grid gap-1.5 text-[10px] leading-4 text-stone-600">

              <p>• Ký quỹ bảo đảm: <strong>1.500.000đ</strong>, hoàn lại sau khi chấm dứt hợp tác và hoàn tất đối soát.</p>

              <p>• Phí ship khách trả và thu nhập shipper là <strong>hai khoản độc lập</strong>.</p>

              <p>• Đơn COD phải thu đúng số tiền và bàn giao/đối soát theo quy trình.</p>

              <p>• Shipper phải bảo quản hàng, bảo mật dữ liệu khách và tuân thủ an toàn giao thông.</p>

            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-200 bg-white p-3">

              <input

                type="checkbox"

                checked={hasAcceptedAgreement}

                onChange={(e) => setHasAcceptedAgreement(e.target.checked)}

                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"

              />

              <span className="text-[11px] leading-4 text-stone-700">

                Tôi xác nhận đã đọc, hiểu và đồng ý với

                <button

                  type="button"

                  onClick={(e) => {

                    e.preventDefault();

                    setShowAgreementModal(true);

                  }}

                  className="ml-1 font-bold text-emerald-700 hover:underline"

                >

                  Thỏa thuận hợp tác đối tác Shipper Anvami

                </button>

                .

              </span>

            </label>

          </div>

          <button

            type="submit"

            disabled={isLoading}

            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-extrabold py-3.5 rounded-2xl transition cursor-pointer text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed"

          >

            {isLoading ? uploadStatus : "NỘP HỒ SƠ ĐĂNG KÝ"}

          </button>

        </form>

        <div className="pt-1 border-t text-center text-xs text-stone-500">

          Đã có tài khoản?{" "}

          <Link href="/login" className="font-extrabold text-blue-600 hover:underline">

            Đăng nhập ngay

          </Link>

        </div>

      </div>

      {/* MODAL THỎA THUẬN HỢP TÁC */}

      {showAgreementModal && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">

          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">

            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-white px-5 py-4">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">

                  Anvami • Đối tác Shipper

                </p>

                <h3 className="mt-1 text-base font-black text-stone-900">

                  Thỏa thuận hợp tác rút gọn

                </h3>

                <p className="mt-1 text-[10px] text-stone-400">

                  Phiên bản {SHIPPER_AGREEMENT_VERSION}

                </p>

              </div>

              <button

                type="button"

                onClick={() => setShowAgreementModal(false)}

                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-500 transition hover:bg-stone-200"

                aria-label="Đóng thỏa thuận"

              >

                ✕

              </button>

            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-900">

                Anvami đang trong giai đoạn thử nghiệm. Nội dung dưới đây là bản tóm tắt để đăng ký điện tử; các quy trình, bảng cước và chính sách được thông báo hợp lệ trong quá trình hoạt động là phần áp dụng cùng thỏa thuận.

              </div>

              {SHIPPER_AGREEMENT_SUMMARY.map((section) => (

                <section

                  key={section.title}

                  className="rounded-2xl border border-stone-100 bg-stone-50 p-3.5"

                >

                  <h4 className="text-[11px] font-black text-stone-800">

                    {section.title}

                  </h4>

                  <p className="mt-1.5 text-[10px] leading-[1.55] text-stone-600">

                    {section.content}

                  </p>

                </section>

              ))}

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[10px] leading-4 text-blue-800">

                Việc bấm “Đồng ý & tiếp tục” được ghi nhận cùng tài khoản, phiên bản thỏa thuận và thời điểm xác nhận.

              </div>

            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-white p-4">

              <button

                type="button"

                onClick={() => setShowAgreementModal(false)}

                className="rounded-xl border border-stone-200 bg-white py-3 text-xs font-bold text-stone-600 transition hover:bg-stone-50 active:scale-95"

              >

                Đóng

              </button>

              <button

                type="button"

                onClick={() => {

                  setHasAcceptedAgreement(true);

                  setShowAgreementModal(false);

                }}

                className="rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"

              >

                Đồng ý & tiếp tục

              </button>

            </div>

          </div>

        </div>

      )}

      {/* CUSTOM MODAL DIALOG */}

      {modal.isOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">

          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-stone-100 transform transition-all animate-in zoom-in-95 duration-200">

            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl mb-4 shadow-sm">

              {modal.type === "error" && (

                <div className="bg-red-100 text-red-600 h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-bold">

                  ✕

                </div>

              )}

              {modal.type === "warning" && (

                <div className="bg-amber-100 text-amber-600 h-14 w-14 rounded-2xl flex items-center justify-center text-2xl">

                  ⚠️

                </div>

              )}

              {modal.type === "success" && (

                <div className="bg-emerald-100 text-emerald-600 h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-bold">

                  ✓

                </div>

              )}

            </div>

            <h3 className="text-base font-black text-stone-800 mb-2">

              {modal.title}

            </h3>

            <p className="text-xs text-stone-500 leading-relaxed mb-6">

              {modal.message}

            </p>

            <div className="space-y-2">

              {modal.onAction && modal.actionText && (

                <button

                  type="button"

                  onClick={() => {

                    modal.onAction?.();

                    setModal((prev) => ({ ...prev, isOpen: false }));

                  }}

                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-sm active:scale-95"

                >

                  {modal.actionText}

                </button>

              )}

              <button

                type="button"

                onClick={() => setModal((prev) => ({ ...prev, isOpen: false }))}

                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition active:scale-95 ${

                  modal.onAction

                    ? "bg-stone-100 text-stone-600 hover:bg-stone-200"

                    : "bg-stone-900 text-white hover:bg-stone-800"

                }`}

              >

                {modal.onAction ? "Đóng lại" : "Hiểu rồi"}

              </button>

            </div>

          </div>

        </div>

      )}

    </main>

  );

}
