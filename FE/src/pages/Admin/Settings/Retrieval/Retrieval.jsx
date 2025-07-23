import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Button,
  message,
  Row,
  Col,
} from 'antd';
import { useUser } from '../../../../hooks/useUser';

const { Option } = Select;

const Retrieval = ({ department, onSave }) => {
  const { user } = useUser();
  const [form] = Form.useForm();

  useEffect(() => {
    if (department) {
      form.setFieldsValue({ department });
    }
  }, [department, form]);

  const onFinish = (values) => {
    message.success('Retrieval settings saved!');
    onSave && onSave(values); // <- call passed callback
  };

  return (
    <Form
      layout="vertical"
      form={form}
      initialValues={{
        department,
        fileLoader: 'docing',
        llm: 'openai',
        numChunks: 5,
        retrievalMode: 'text',
        prioritizeTables: false,
        useMMR: false,
        useReranking: false,
        useLLMScoring: false,
      }}
      onFinish={onFinish}
    >
      {/* Department */}
      <Form.Item label="Department" name="department">
        <Input disabled />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="File Loader" name="fileLoader" rules={[{ required: true }]}>
            <Select>
              <Option value="docing">DocIng (figure+table extraction)</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="LLM for Relevant Scoring" name="llm" rules={[{ required: true }]}>
            <Select>
              <Option value="openai">Open AI</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Number of Chunks to Retrieve" name="numChunks" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Retrieval Mode" name="retrievalMode" rules={[{ required: true }]}>
            <Select>
              <Option value="text">Text</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Advanced Options">
        <Checkbox.Group style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <Checkbox value="prioritizeTables" name="prioritizeTables">Prioritize Tables</Checkbox>
          <Checkbox value="useMMR" name="useMMR">Use MMR</Checkbox>
          <Checkbox value="useReranking" name="useReranking">Use Reranking</Checkbox>
          <Checkbox value="useLLMScoring" name="useLLMScoring">Use LLM Relevant Scoring</Checkbox>
        </Checkbox.Group>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Save changes
        </Button>
      </Form.Item>
    </Form>
  );
};

export default Retrieval;
