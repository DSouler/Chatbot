from seleniumbase import BaseCase
BaseCase.main(__name__, __file__)
from selenium.webdriver.common.keys import Keys

class DemoSiteTests(BaseCase):
    def test_demo_site(self):
        self.open("http://10.1.12.89:7860/")
        self.sleep(3)  # wait for page load
        self.type(
            "/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[2]/div/div[2]/div[1]/label/textarea",
            "admin",
            by="xpath"
        )
        self.type(
            "/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[2]/div/div[2]/div[2]/label/input",
            "admin",
            by="xpath"
        )
        self.click("/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[2]/div/button", by="xpath")
        self.sleep(1)  # wait for page load
        #choose file collection
        self.click("/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[3]/div/div[1]/div[1]/div[6]/div[2]/div/fieldset/div[2]/label[2]", by="xpath")
        
        print("Init")
        with open("C:/Users/tai.nguyentuan/Documents/clone_rag/atmalab-rag/ragas_input_dataset/test.txt", "r") as file:
            lines = file.readlines()

        # Remove trailing newline characters
        lines = [line.strip() for line in lines]
            #input question
        for line in lines:
            self.type(
                "/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[3]/div/div[1]/div[2]/div[2]/div/label/div/textarea",
                line,
                by="xpath"
            )
            #get response
            self.send_keys(
                "/html/body/gradio-app/div/div/div[1]/div/div/div[1]/div[3]/div/div[1]/div[2]/div[2]/div/label/div/textarea",
                Keys.ENTER,
                by="xpath"
            )
            self.sleep(60)  # wait for page load
            latest_element = self.get_element(
                "(//*[contains(concat(' ', normalize-space(@class), ' '), ' bot-row ')])[last()]",
                by="xpath"
            )
            output_path = "C:/Users/tai.nguyentuan/Documents/clone_rag/atmalab-rag/ragas_input_dataset/groundtruth.txt"
            response = latest_element.text
            # Convert to single line
            single_line_response = " ".join(response.split())

            with open(output_path, "a", encoding="utf-8") as file:
                file.write(single_line_response + "\n")