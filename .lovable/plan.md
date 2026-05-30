## Mục tiêu
Website theo dõi chuyến bay tại các sân bay Việt Nam (SGN, HAN, DAD, CXR, HPH, VCA…) với dữ liệu thật từ API hàng không.

## Tính năng chính
1. **Trang chủ** — Chọn sân bay VN, hiển thị nhanh số chuyến đến/đi hôm nay, các chuyến sắp tới.
2. **Bảng Đến/Đi (FIDS)** — Bảng chuyến bay theo sân bay: số hiệu, hãng, điểm đi/đến, giờ dự kiến, giờ thực tế, trạng thái (On time / Delayed / Cancelled / Landed), cổng/terminal. Tự refresh mỗi 60s.
3. **Tìm kiếm chuyến bay** — Theo số hiệu (VN123, VJ456…) hoặc theo hãng (Vietnam Airlines, Vietjet, Bamboo…).
4. **Bản đồ realtime** — Hiển thị máy bay đang bay trong/qua không phận VN trên bản đồ, click để xem chi tiết.
5. **Thống kê** — Biểu đồ: tỉ lệ đúng giờ theo sân bay, số chuyến/ngày, top hãng bay, top tuyến bay.

## Nguồn dữ liệu
Đề xuất **AviationStack** (gói free 100 req/tháng cho demo, có dữ liệu sân bay VN tốt) cho lịch chuyến bay + thống kê, và **OpenSky Network** (miễn phí, không cần key) cho vị trí máy bay realtime trên bản đồ.

Cần xin user API key: `AVIATIONSTACK_API_KEY` (lưu qua add_secret).

## Kiến trúc kỹ thuật
- **TanStack Start** (đã có sẵn) — file-based routing trong `src/routes/`
- **Server functions** (`createServerFn`) gọi AviationStack/OpenSky để giấu API key, tránh CORS, cache 60s
- **TanStack Query** đã có — dùng `useSuspenseQuery` + auto-refetch interval cho bảng FIDS
- **Bản đồ**: Leaflet + OpenStreetMap (miễn phí, không cần key) — hiển thị icon máy bay xoay theo heading
- **Biểu đồ**: Recharts (đã có sẵn trong template)
- **UI**: shadcn/ui + Tailwind, theme tối kiểu bảng điện tử sân bay (sẽ generate 3 design directions để bạn chọn)

### Cấu trúc route
```text
src/routes/
  __root.tsx        layout + nav (Trang chủ / Sân bay / Bản đồ / Thống kê)
  index.tsx         trang chủ — chọn sân bay, highlight
  airports.$code.tsx   /airports/SGN — bảng Đến/Đi của 1 sân bay
  flights.$number.tsx  /flights/VN123 — chi tiết 1 chuyến bay
  map.tsx           bản đồ realtime
  stats.tsx         dashboard thống kê
  api/
    flights.ts      server route proxy AviationStack
    live.ts         server route proxy OpenSky bbox VN
```

### Danh sách sân bay VN (hardcoded)
SGN, HAN, DAD, CXR, HPH, VCA, VII, HUI, UIH, PXU, BMV, DLI, VCS, THD, VKG, TBB, VCL, DIN, CAH

## Trình tự triển khai
1. Sinh 3 design directions (giao diện FIDS sân bay) → bạn chọn 1
2. Setup design system + layout + navigation theo direction đã chọn
3. Xin API key AviationStack qua add_secret
4. Server functions gọi AviationStack (departures/arrivals) + OpenSky (live positions)
5. Trang chủ + bảng Đến/Đi với auto-refresh
6. Tìm kiếm chuyến bay + trang chi tiết
7. Bản đồ realtime với Leaflet
8. Trang thống kê với Recharts
9. SEO meta cho từng route + responsive mobile

## Câu hỏi còn lại trước khi bắt đầu
- Ngôn ngữ giao diện: **chỉ tiếng Việt**, **chỉ tiếng Anh**, hay **song ngữ có nút chuyển**?
- Có cần lưu danh sách "chuyến bay yêu thích" của người dùng không (cần đăng nhập + Lovable Cloud)? Mặc định **không** cho gọn.
