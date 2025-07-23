import React from "react";
import { Modal, Form, Input, Button, Select } from "antd";

const { Option } = Select;

const AddUser = ({ visible, onCreate, onCancel }) => {
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
      title="Add User"
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
          name="name"
          label="Name"
          rules={[
            { required: true, message: "Please input Name!" },
            { max: 255, message: "Maximum length is 255 characters" },
          ]}
        >
          <Input maxLength={255} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Please input Email!" },
            { type: "email", message: "Invalid email format" },
            { max: 255, message: "Maximum length is 255 characters" },
          ]}
        >
          <Input maxLength={255} />
        </Form.Item>

        <Form.Item
          name="company"
          label="Company"
          rules={[{ required: true, message: "Please select Company!" }]}
        >
          <Select placeholder="Select company">
            <Option value="VTI">VTI</Option>
            <Option value="VJP">VJP</Option>
            <Option value="VKR">VKR</Option>
            <Option value="VAP">VAP</Option>
            <Option value="HRI">HRI</Option>
            <Option value="EDU">EDU</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="group_user"
          label="Department"
          rules={[{ required: true, message: "Please select Department!" }]}
        >
          <Select placeholder="Select group">
            <Option value="G2">G2</Option>
            <Option value="G3">G3</Option>
            <Option value="G4">G4</Option>
            <Option value="G5">G5</Option>
            <Option value="G6">G6</Option>
            <Option value="G7">G7</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="position"
          label="Position"
          rules={[{ required: true, message: "Please select Position!" }]}
        >
          <Select placeholder="Select position">
            <Option value="Intern">Intern</Option>
            <Option value="Developer">Developer</Option>
            <Option value="Manager">Manager</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="level"
          label="Level"
          rules={[{ required: true, message: "Please select Level!" }]}
        >
          <Select placeholder="Select level">
            <Option value={0}>Level 0</Option>
            <Option value={1}>Level 1</Option>
            <Option value={2}>Level 2</Option>
            <Option value={3}>Level 3</Option>
            <Option value={4}>Level 4</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: "Please select Status!" }]}
        >
          <Select placeholder="Select status">
            <Option value="Active">Active</Option>
            <Option value="Blocked">Blocked</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: false }]}
        >
          <Input.TextArea rows={4} placeholder="Enter description..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddUser;
