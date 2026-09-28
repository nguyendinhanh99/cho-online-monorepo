import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const bank =
      searchParams.get(
        "bank"
      );

    const acc =
      searchParams.get(
        "acc"
      );

    const amount =
      searchParams.get(
        "amount"
      );

    const des =
      searchParams.get(
        "des"
      );

    const holder =
      searchParams.get(
        "holder"
      );

    if (
      !bank ||
      !acc ||
      !amount ||
      !des
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Thiếu dữ liệu tạo QR",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       VIETQR URL
    ===================================================== */

    const vietQrUrl =
      new URL(
        "https://vietqr.app/img"
      );

    vietQrUrl.searchParams.set(
      "bank",
      bank
    );

    vietQrUrl.searchParams.set(
      "acc",
      acc
    );

    vietQrUrl.searchParams.set(
      "template",
      "compact"
    );

    vietQrUrl.searchParams.set(
      "amount",
      amount
    );

    vietQrUrl.searchParams.set(
      "des",
      des
    );

    if (holder) {
      vietQrUrl.searchParams.set(
        "holder",
        holder
      );
    }

    /* =====================================================
       GET QR IMAGE
    ===================================================== */

    const response =
      await fetch(
        vietQrUrl.toString(),
        {
          cache: "no-store",
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Không lấy được QR: ${response.status}`
      );
    }

    const image =
      await response.arrayBuffer();

    const upstreamContentType =
      response.headers.get(
        "content-type"
      );

    const contentType =
      upstreamContentType &&
      upstreamContentType.startsWith(
        "image/"
      )
        ? upstreamContentType
        : "image/png";

    /* =====================================================
       SAFE FILE NAME
    ===================================================== */

    const safeCode =
      des.replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

    return new NextResponse(
      image,
      {
        status: 200,

        headers: {
          "Content-Type":
            contentType,

          /**
           * inline:
           * - Safari có thể xử lý response như ảnh
           * - page.tsx sẽ fetch blob rồi mở Share Sheet
           * - không ép iOS vào luồng "Lưu vào Files"
           */
          "Content-Disposition":
            `inline; filename="Anvami-VietQR-${safeCode}.png"`,

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "[DOWNLOAD QR ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error?.message ||
          "Không thể tải mã QR",
      },
      {
        status: 500,
      }
    );
  }
}
