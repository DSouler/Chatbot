import React from "react";
import { Modal, Form, Input, Button } from "antd";

const AddTenant = ({ visible, onCreate, onCancel, userEmail }) => {
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
      title="Add Company"
      onCancel={onCancel}
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
          name="tenant"
          label="Company Name"
          rules={[{ required: true, message: "Please input Company Name!" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: "Please input Email!" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea rows={3} placeholder="Description..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTenant;