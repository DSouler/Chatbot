import logging
import openai
import threading
import config
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MetaDataFilterEngine:
    """
    Processing MetaDataFilterEngine
    """
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            logger.info("Creating new MetaDataFilterEngine instance")
            cls._instance = super(MetaDataFilterEngine, cls).__new__(cls)
        return cls._instance

    def __init__(
            self,
            llm_client: openai.OpenAI,
            model_name: str = config.DEFAULT_MODEL_NAME,
    ):
        if not self._initialized:
            self.llm_client = llm_client
            self.model_name = model_name
            self.__class__._initialized = True
            logger.info("MetaDataFilterEngine initialized")

    def _call_llm_for_classification(self, system_prompt: str, message: str) -> str:
        """Helper function to call LLM with a specific prompt and return a clean string."""
        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message + " /no_think"}
                ],
                temperature=0,
            )
            # Lấy nội dung trả về và loại bỏ khoảng trắng dư thừa
            result = response.choices[0].message.content.strip()
            logger.info(f"LLM classified with result: '{result}'")
            return result
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            return ""

    def ExtractTopic(self, message: str) -> str:
        "Return the Topic of the given message"
        system_prompt = """
            Bạn là một AI chuyên phân loại chủ đề của câu hỏi. Hãy đọc câu hỏi và trả về CHỈ MỘT mã ID chủ đề tương ứng.
            Nếu không có chủ đề nào phù hợp, hãy trả về một chuỗi rỗng.
            KHÔNG giải thích. KHÔNG thêm bất kỳ ký tự nào khác.

            Các mã ID chủ đề:
            - "mt1": lương thưởng, tạm ứng lương.
            - "mt2": chấm công, OT, overtime, gồm các quy định về việc ghi nhận thời gian làm việc, xử lý các vấn đề như đi muộn, về sớm, quên chấm công, thời gian làm việc, làm thêm giờ và các chế độ nghỉ (như nghỉ phép hằng năm, nghỉ chế độ có hưởng lương: nghỉ kết hôn, nghỉ hiếu - tang, nghỉ ngày "đèn đỏ", nghỉ mát, nghỉ thai sản, ốm đau).
            - "mt3": quy định chung, gồm các quy định mang tính áp dụng chung cho toàn bộ công ty, như quy định nghỉ việc, phân loại chức danh công việc, quy trình hỗ trợ nhân viên onboard, quy định điền thông tin trên hệ thống, quy định phụ cấp cán bộ phong trào, quy định chính sách chim én về tổ, quy định sử dụng quỹ phát triển đơn vị, quy định đánh giá và sử dụng sinh viên thực tập, quy định chính sách quà tặng thâm niên, quy định trợ cấp tiếp khách của comptor.
            - "mt4": nội quy lao động, thỏa ước lao động
            - "mt5": bổ nhiệm, thăng chức
        """
        return self._call_llm_for_classification(system_prompt, message)

    def ExtractDocumentType(self, message: str) -> str:
        "Return the Document type of the given message"
        system_prompt = """
            Bạn là một AI chuyên phân loại tài liệu được đề cập trong câu hỏi. Hãy đọc câu hỏi và trả về CHỈ MỘT mã ID loại tài liệu tương ứng.
            Nếu không có loại nào phù hợp, hãy trả về một chuỗi rỗng.
            KHÔNG giải thích. KHÔNG thêm bất kỳ ký tự nào khác.

            Các mã ID loại tài liệu:
            - "dt1": Quy định, Nội quy. Bao gồm các nguyên tắc và yêu cầu bắt buộc mà tất cả nhân viên hoặc các bên liên quan phải tuân thủ trong một lĩnh vực cụ thể.
            - "dt2": Quy trình. Mô tả chi tiết từng bước, thứ tự thực hiện một công việc hay một hoạt động cụ thể để đạt được kết quả nhất quán và hiệu quả.
            - "dt3": Thỏa thuận, thỏa ước. Là văn bản ghi nhận sự đồng thuận, cam kết giữa hai hay nhiều bên về một vấn đề cụ thể. Thỏa thuận ràng buộc trách nhiệm và quyền lợi của các bên tham gia. Ví dụ: Thỏa thuận bảo mật thông tin (NDA), Thỏa thuận hợp tác kinh doanh
            - "dt4": Hướng dẫn, giải thích hoặc các bước gợi ý để thực hiện một công việc nào đó một cách chính xác và dễ dàng hơn. Ví dụ: Hướng dẫn sử dụng phần mềm chấm công
            - "dt5": Biểu mẫu, đơn, Là các mẫu văn bản được thiết kế sẵn với các mục thông tin cố định để người dùng điền vào. Ví dụ: Biểu mẫu xin nghỉ phép, Biểu mẫu đề xuất mua sắm, Biểu mẫu đánh giá nhân viên.
        """
        return self._call_llm_for_classification(system_prompt, message)

    def ExtractDepartment(self, message: str) -> str:
        "Return the Department related of the given message"
        # Sửa tên hàm từ ExtractDepartmentSearch -> ExtractDepartment cho nhất quán
        system_prompt = """
            Bạn là một AI chuyên xác định phòng ban được đề cập trong câu hỏi. Hãy đọc câu hỏi và trả về CHỈ MỘT mã phòng ban tương ứng.
            Nếu không có phòng ban nào phù hợp, hãy trả về một chuỗi rỗng.
            KHÔNG giải thích. KHÔNG thêm bất kỳ ký tự nào khác.

            Các mã phòng ban:
            - "HR": Phòng Nhân sự (Human Resource)
            - "GA": Phòng Hành chính (General Affairs)
        """
        # return self._call_llm_for_classification(system_prompt, message)
        return "HR"

    def __call__(self, message: str) -> dict:
        """
        Chạy song song cả 3 hàm extract bằng threading và trả về kết quả.
        """
        logger.info(f"Running all extractions in parallel with threading for: '{message}'")

        results = {}

        with ThreadPoolExecutor(max_workers=3) as executor:
            # Gửi các tác vụ vào pool
            future_to_key = {
                executor.submit(self.ExtractDepartment, message): "department",
                # executor.submit(self.ExtractDocumentType, message): "doc_type",
                executor.submit(self.ExtractTopic, message): "topic",
            }

            # Thu thập kết quả khi các luồng hoàn thành
            for future in future_to_key:
                key = future_to_key[future]
                try:
                    results[key] = future.result()
                except Exception as exc:
                    logger.error(f'{key} generated an exception: {exc}')
                    results[key] = ""

        logger.info(f"Parallel extraction completed: {results}")
        return results