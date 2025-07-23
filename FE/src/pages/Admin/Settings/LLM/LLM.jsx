import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  message,
  Row,
  Col,
  Typography,
  Card,
} from 'antd';
import { useUser } from '../../../../hooks/useUser';
import { useLLMConfig } from '../../../../hooks/useLLMConfig';

const { Option } = Select;
const { Title, Text } = Typography;

const LLM = ({ onSave }) => {
  const { user } = useUser();
  const { llmConfig, updateLLMConfig } = useLLMConfig();
  const [form] = Form.useForm();

  useEffect(() => {
    // Set form values from current config
    form.setFieldsValue(llmConfig);
  }, [llmConfig, form]);

  const onFinish = (values) => {
    // Update LLM config
    updateLLMConfig(values);
    message.success('LLM settings saved!');
    onSave && onSave(values);
  };

  // Danh sách các model có sẵn
  const availableModels = [
    { value: 'Qwen/Qwen3-14B-AWQ', label: 'Qwen3-14B-AWQ (Default)' },
    { value: 'Qwen/Qwen3-8B', label: 'Qwen/Qwen3-8B' },
    { value: 'Qwen/Qwen3-32B-AWQ', label: 'Qwen3-32B-AWQ' },
    { value: 'cognitivecomputations/Qwen3-30B-A3B-AWQ', label: 'Qwen3-30B-A3B-AWQ' },
    { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct' },
    { value: 'Qwen/Qwen2.5-7B', label: 'Qwen2.5-7B' },
    { value: 'Qwen/Qwen2.5-14B-Instruct', label: 'Qwen2.5-14B-Instruct' },
    { value: 'Qwen/Qwen2.5-14B-Instruct-AWQ', label: 'Qwen2.5-14B-Instruct-AWQ' },
    { value: 'deepseek-ai/DeepSeek-V2-Lite-Chat', label: 'deepseek-ai/DeepSeek-V2-Lite-Chat' },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>LLM Model Configuration</Title>
        <Text type="secondary">
          Configure the language model used for chat responses. The selected model will be used for all conversations in this department.
        </Text>
      </Card>

      <Form
        layout="vertical"
        form={form}
        initialValues={{
          model: 'Qwen/Qwen3-14B-AWQ',
          temperature: 0.7,
        }}
        onFinish={onFinish}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Language Model"
              name="model"
              rules={[{ required: true, message: 'Please select a model' }]}
            >
              <Select
                showSearch
                placeholder="Select a model"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option?.label?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {availableModels.map(model => (
                  <Option key={model.value} value={model.value} label={model.label}>
                    {model.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Temperature"
              name="temperature"
              rules={[{ required: true, message: 'Please set temperature' }]}
            >
              <Select>
                <Option value={0.1}>0.1 - Focused</Option>
                <Option value={0.3}>0.3 - Balanced</Option>
                <Option value={0.5}>0.5 - Balanced</Option>
                <Option value={0.7}>0.7 - Creative</Option>
                <Option value={0.9}>0.9 - Very Creative</Option>
                <Option value={1}>1 - Maximum Creativity</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Save LLM Settings
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default LLM; 