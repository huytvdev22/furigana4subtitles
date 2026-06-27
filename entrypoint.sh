#!/bin/bash
set -e

# Nếu không truyền đối số, in hướng dẫn sử dụng
if [ "$#" -lt 1 ]; then
    echo "=================================================================="
    echo "         Furigana4Subtitles Docker Burn-in Tool                   "
    echo "=================================================================="
    echo "Cú pháp sử dụng:"
    echo "  docker run --rm -v \$(pwd):/data furigana4subtitles <file_srt> [file_video] [file_output]"
    echo ""
    echo "Chế độ 1: Chỉ tạo file phụ đề .ass (không ghép vào video)"
    echo "  docker run --rm -v \$(pwd):/data furigana4subtitles /data/sub.srt"
    echo ""
    echo "Chế độ 2: Tạo file phụ đề .ass và tự động Burn-in vào video"
    echo "  docker run --rm -v \$(pwd):/data furigana4subtitles /data/sub.srt /data/video.mp4"
    echo ""
    echo "Chế độ 3: Chỉ định rõ tên file video đầu ra mong muốn"
    echo "  docker run --rm -v \$(pwd):/data furigana4subtitles /data/sub.srt /data/video.mp4 /data/output_hardsub.mp4"
    echo ""
    echo "Chế độ 4: Điều chỉnh tốc độ hàng loạt cho các file âm thanh trong thư mục"
    echo "  docker run --rm -v \$(pwd):/data furigana4subtitles speed <tốc_độ> [phần_mở_rộng]"
    echo "=================================================================="
    exit 1
fi

# Chế độ 4: Điều chỉnh tốc độ hàng loạt cho các file âm thanh
if [ "$1" = "speed" ]; then
    SPEED="$2"
    EXT="${3:-mp3}"
    
    if [ -z "$SPEED" ]; then
        echo "Lỗi: Vui lòng chỉ định tốc độ (ví dụ: 0.9)"
        exit 1
    fi

    echo "==== Đang điều chỉnh tốc độ của các file .$EXT trong /data sang ${SPEED}x... ===="
    
    shopt -s nullglob
    FILES=(/data/*."$EXT")
    
    if [ ${#FILES[@]} -eq 0 ]; then
        echo "Không tìm thấy file nào có phần mở rộng .$EXT trong thư mục /data"
        exit 0
    fi

    for f in "${FILES[@]}"; do
        filename=$(basename "$f")
        rawname="${filename%.*}"
        
        # Bỏ qua các file đã xử lý để tránh lặp vô hạn
        if [[ "$rawname" == *"_speed"* ]]; then
            echo "Bỏ qua file đã xử lý: $filename"
            continue
        fi
        
        output="/data/${rawname}_speed${SPEED}.${EXT}"
        echo "Đang xử lý: $filename -> $(basename "$output")"
        
        ffmpeg -y -i "$f" -filter:a "atempo=${SPEED}" "$output"
    done
    
    echo "==== HOÀN THÀNH việc điều chỉnh tốc độ! ===="
    exit 0
fi

SRT_FILE="$1"
VIDEO_FILE="$2"
OUTPUT_FILE="$3"

# Xác định đường dẫn file .ass sẽ sinh ra (cùng thư mục và cùng tên với file .srt)
SRT_DIR=$(dirname "$SRT_FILE")
SRT_BASE=$(basename "$SRT_FILE")
SRT_RAW="${SRT_BASE%.*}"
ASS_FILE="${SRT_DIR}/${SRT_RAW}.ass"

echo "==== [1/2] Đang tạo phụ đề .ass có Furigana (Font: Osaka-Mono)... ===="
./furigana4subtitles "$SRT_FILE"

if [ ! -f "$ASS_FILE" ]; then
    echo "Lỗi: Không tìm thấy file .ass được tạo tại $ASS_FILE"
    exit 1
fi
echo "Đã tạo phụ đề thành công tại: $ASS_FILE"

# Nếu người dùng cung cấp file video, tiến hành burn-in
if [ -n "$VIDEO_FILE" ]; then
    if [ ! -f "$VIDEO_FILE" ]; then
        echo "Lỗi: Không tìm thấy file video đầu vào tại $VIDEO_FILE"
        exit 1
    fi

    # Tự động tạo tên file output nếu không chỉ định
    if [ -z "$OUTPUT_FILE" ]; then
        VIDEO_DIR=$(dirname "$VIDEO_FILE")
        VIDEO_BASE=$(basename "$VIDEO_FILE")
        VIDEO_RAW="${VIDEO_BASE%.*}"
        VIDEO_EXT="${VIDEO_BASE##*.}"
        OUTPUT_FILE="${VIDEO_DIR}/${VIDEO_RAW}_furigana.${VIDEO_EXT}"
    fi

    echo "==== [2/2] Đang tiến hành Burn-in phụ đề vào video bằng FFmpeg... ===="
    echo "-> Video gốc: $VIDEO_FILE"
    echo "-> File phụ đề: $ASS_FILE"
    echo "-> Video đầu ra: $OUTPUT_FILE"

    # Thực hiện lệnh burn-in phụ đề bằng FFmpeg dùng filter subtitles
    # filter subtitles sẽ tự động lấy font Osaka-Mono đã được cài đặt trong container để render
    ffmpeg -y -i "$VIDEO_FILE" -vf "subtitles='$ASS_FILE'" -c:a copy "$OUTPUT_FILE"

    echo "==== HOÀN THÀNH! Video hardsub đã được lưu tại: $OUTPUT_FILE ===="
else
    echo "==== HOÀN THÀNH! Đã tạo xong file .ass tại: $ASS_FILE (Không có video đầu vào để burn-in) ===="
fi
