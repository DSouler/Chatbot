import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Radio,
  Checkbox,
  InputNumber,
  Button,
  message,
  Typography,
  Row,
  Col,
} from 'antd';
import { useUser } from '../../../../hooks/useUser';

const { Option } = Select;

const Reasoning = ({ department, onSave }) => {
  const { user } = useUser();
  const [form] = Form.useForm();

  useEffect(() => {
    if (department) {
      form.setFieldsValue({ department });
    }
  }, [department]);

  const onFinish = (values) => {
    message.success('Reasoning settings saved!');
    if (onSave) {
      onSave(values); // Only send this row's values
    }
  };

  return (
    <Form
      layout="vertical"
      form={form}
      initialValues={{
        department,
        language: 'Japanese',
        maxContextLength: 3200,
        reasoningFramework: 'simple',
        examplePrompt: '',
        languageModel: 'Open AI',
        highlightCitation: false,
        systemPrompt: '',
        numInteractions: 0,
        maxMessageLength: 0,
      }}
      onFinish={onFinish}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Department" name="department">
            <Input disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Language" name="language">
            <Select>
              <Option value="Japanese">Japanese</Option>
              <Option value="English">English</Option>
              <Option value="Vietnamese">Vietnamese</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Max Context Length (LLM)" name="maxContextLength">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label="Reasoning Options" name="reasoningFramework">
        <Radio.Group>
          <Radio value="simple">Simple</Radio>
          <Radio value="complex">Complex</Radio>
          <Radio value="react">React</Radio>
          <Radio value="rewoo">Rewoo</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="Example Prompt" name="examplePrompt">
        <Typography.Paragraph code>
          "Explain the quarterly financial results of Company A in simple terms."
        </Typography.Paragraph>
      </Form.Item>

      <Form.Item label="Language Model" name="languageModel">
        <Select>
          <Option value="Open AI">Open AI</Option>
          <Option value="Anthropic">Anthropic</Option>
          <Option value="Google Gemini">Google Gemini</Option>
        </Select>
      </Form.Item>

      <Form.Item name="highlightCitation" valuePropName="checked">
        <Checkbox>Highlight citation</Checkbox>
      </Form.Item>

      <Form.Item label="System Prompt" name="systemPrompt">
        <Input />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Number of interactions to include" name="numInteractions">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Maximum message length for context rewriting" name="maxMessageLength">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Save changes
        </Button>
      </Form.Item>
    </Form>
  );
};

export default Reasoning;
