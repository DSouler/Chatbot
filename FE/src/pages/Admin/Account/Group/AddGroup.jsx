import React from "react";
import { Modal, Form, Input, Button, Select } from "antd";

const companyOptions = ["VTI", "VJP", "VKR", "VAP", "HRI", "EDU"];

const AddGroup = ({ visible, onCreate, onCancel }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        form.resetFields();
        onCreate(values);
      })
      .catch(() => {});
  };

  return (
    <Modal
      open={visible}
      title="Add Group"
      onCancel={onCancel}
      onOk={handleOk}
      footer={[
        <Button key="back" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          Add
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="company"
          label="Company"
          rules={[{ required: true, message: "Please select Company!" }]}
        >
          <Select placeholder="Select a company">
            {companyOptions.map((comp) => (
              <Select.Option key={comp} value={comp}>
                {comp}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="group"
          label="Group Name"
          rules={[{ required: true, message: "Please input Group Name!" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddGroup;
