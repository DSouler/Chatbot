import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';

const { Option } = Select;

const AddSettings = ({ visible, onCreate, onCancel }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [visible]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const defaultSettings = {
          retrieval: {
            language: 'English',
            chunkSize: 300,
            similarityThreshold: 0.8,
          },
          reasoning: {
            languageModel: 'Open AI',
            maxContextLength: 3200,
            reasoningFramework: 'simple',
          },
        };

        const newSetting = {
          ...values,
          ...defaultSettings,
        };

        onCreate(newSetting);
        form.resetFields();
        message.success('New setting added successfully');
      })
      .catch((info) => {
        console.log('Validation Failed:', info);
      });
  };

  return (
    <Modal
      open={visible}
      title="Add New Setting"
      onCancel={onCancel}
      onOk={handleOk}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          Add
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Company"
          name="company"
          rules={[{ required: true, message: 'Please select a company' }]}
        >
          <Select placeholder="Select company">
            <Option value="VTI">VTI</Option>
            <Option value="VJP">VJP</Option>
            <Option value="VKR">VKR</Option>
            <Option value="HRI">HRI</Option>
            <Option value="EDU">EDU</Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="Department"
          name="department"
          rules={[{ required: true, message: 'Please input department name' }]}
        >
          <Select placeholder="Select department">
            <Option value="G2">G2</Option>
            <Option value="G3">G3</Option>
            <Option value="G4">G4</Option>
            <Option value="G5">G5</Option>
            <Option value="G7">G7</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddSettings;
