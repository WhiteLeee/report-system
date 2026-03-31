# 获取身份凭证

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /sign:
    get:
      summary: 获取身份凭证
      deprecated: false
      description: ''
      tags:
        - 默认模块/开放平台须知
        - 开放平台
      parameters:
        - name: key
          in: query
          description: 一般为企业编码
          required: false
          example: '{{appid}}'
          schema:
            type: string
        - name: secret
          in: query
          description: 企业秘钥
          required: false
          example: '{{secret}}'
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            '*/*':
              schema:
                type: object
                properties: {}
              example: |
                {"error_msg":"404 Route Not Found"}
          headers: {}
          x-apifox-name: 成功
        '401':
          description: ''
          content:
            '*/*':
              schema:
                type: object
                properties: {}
          headers: {}
          x-apifox-name: 参数错误或者值不正确
      security: []
      x-apifox-folder: 默认模块/开放平台须知
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/2703503/apis/api-89690845-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```

# 新增整改单开放平台接口

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /route/ri/open/item/create:
    post:
      summary: 新增整改单开放平台接口
      deprecated: false
      description: ''
      tags:
        - 默认模块/开放平台接口/巡检/整改单
      parameters:
        - name: version
          in: query
          description: ''
          example: '1'
          schema:
            type: string
        - name: token
          in: header
          description: ''
          example: '111'
          schema:
            type: string
            default: '111'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                storeId:
                  type: number
                  description: 门店id 二选一
                storeCode:
                  type: string
                  description: 门店code  二选一
                description:
                  type: string
                  description: 不合格说明，长度最长500
                shouldCorrected:
                  type: string
                  description: 要求整改日期
                imageUrls:
                  type: array
                  items:
                    type: string
                    description: url
                  description: 图片的公网url数组，length 最大9
              x-apifox-orders:
                - storeId
                - storeCode
                - description
                - shouldCorrected
                - imageUrls
              required:
                - description
                - shouldCorrected
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: boolean
                    description: 结果返回 true ； false
                  status:
                    type: integer
                    description: 响应码
                required:
                  - data
                  - status
                x-apifox-orders:
                  - data
                  - status
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 默认模块/开放平台接口/巡检/整改单
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/2703503/apis/api-255257546-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```

# 整改单列表查询接口

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /route/ri/open/item/list:
    post:
      summary: 整改单列表查询接口
      deprecated: false
      description: ''
      tags:
        - 默认模块/开放平台接口/巡检/整改单
      parameters:
        - name: version
          in: query
          description: ''
          required: true
          schema:
            type: string
        - name: Content-Type
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
        - name: token
          in: header
          description: ''
          required: true
          schema:
            type: string
        - name: ent
          in: header
          description: ''
          required: true
          example: ''
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                searchName:
                  type: string
                  description: 门店名称以及编码
                ifCorrected:
                  type: string
                  description: 状态 -- 0 未整改   1  已整改   2待审核
                itemSource:
                  type: string
                  description: 来源  --zj门店自检  cg常规巡检  sp视频巡检  zx专项巡检 fi 飞行巡检 ai ai巡检  no 无来源
                pageNumber:
                  type: number
                  description: 当前页
                pageSize:
                  type: number
                  description: 每页数
                creatorCode:
                  type: string
                  description: 创建人编码
                startDate:
                  type: string
                  description: 开始日期（yyyy-MM-dd）
                endDate:
                  type: string
                  description: 结束日期（yyyy-MM-dd）
                organizeCode:
                  type: number
                  description: 运营组织编码
                modifyStartDate:
                  type: string
                  description: 修改开始日期（yyyy-MM-dd）
                modifyEndDate:
                  type: string
                  description: 修改结束日期（yyyy-MM-dd）
              x-apifox-orders:
                - searchName
                - organizeCode
                - creatorCode
                - ifCorrected
                - itemSource
                - pageNumber
                - pageSize
                - startDate
                - endDate
                - modifyStartDate
                - modifyEndDate
              required:
                - startDate
                - endDate
                - modifyStartDate
                - modifyEndDate
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  totalRow:
                    type: number
                  pageNumber:
                    type: number
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        employeeName:
                          type: string
                          description: 巡检人名称
                        ifCorrected:
                          type: string
                          description: 是否整改 0=未整改,1=已整改,2=待审核
                        reportId:
                          type: number
                          description: 报告ID
                        franchiseeName:
                          type: string
                          description: 加盟商名称
                        fullName:
                          type: string
                          description: 门店名称
                        description:
                          type: string
                          description: 不合格描述
                        source:
                          type: string
                          description: 来源
                        correctedStatus:
                          type: string
                          description: 逾期状态
                        nameLink:
                          type: string
                          description: 运营组织名称
                        createTime:
                          type: string
                          description: 创建时间
                        disqualifiedId:
                          type: number
                          description: 整改单ID
                        shouldCorrected:
                          type: string
                          description: 要求整改时间
                        storeCode:
                          type: string
                          description: 门店编码
                        inspectionPointsStr:
                          type: string
                          description: 检查要点信息
                        examiner:
                          type: string
                          description: 审核人
                        examineTime:
                          type: string
                          description: 审核时间
                        ifQualified:
                          type: string
                          description: '是否合格 1=合格,0=不合格 '
                        realCorrected:
                          type: string
                          description: 实际完成整改日期
                        inspectionPoints:
                          type: array
                          items:
                            type: object
                            properties:
                              pointName:
                                type: string
                                description: 要点名称
                              pointTypes:
                                type: string
                                description: 1 加分 2 减分
                              pointScore:
                                type: string
                                description: 实际分数
                            x-apifox-orders:
                              - pointName
                              - pointTypes
                              - pointScore
                            required:
                              - pointName
                              - pointTypes
                              - pointScore
                          description: 要点信息
                        contentTitle:
                          type: string
                          description: 巡检项名称
                        storeId:
                          type: string
                          description: 门店id
                        markNames:
                          type: string
                          description: 要点名称
                        itemId:
                          type: string
                          description: 巡检项id
                        correctDays:
                          type: string
                          description: 逾期的天数
                        realCorrectedTime:
                          type: string
                          description: 实际完成整改时间
                        modifiedTime:
                          type: string
                          description: 修改时间
                      x-apifox-orders:
                        - employeeName
                        - ifCorrected
                        - reportId
                        - franchiseeName
                        - fullName
                        - description
                        - source
                        - correctedStatus
                        - nameLink
                        - createTime
                        - disqualifiedId
                        - shouldCorrected
                        - storeCode
                        - inspectionPointsStr
                        - examiner
                        - examineTime
                        - ifQualified
                        - realCorrected
                        - realCorrectedTime
                        - inspectionPoints
                        - contentTitle
                        - storeId
                        - markNames
                        - itemId
                        - correctDays
                        - modifiedTime
                      required:
                        - realCorrectedTime
                        - modifiedTime
                  totalPage:
                    type: number
                  isLastPage:
                    type: boolean
                  pageSize:
                    type: number
                  isFirstPage:
                    type: boolean
                  status:
                    type: number
                x-apifox-orders:
                  - totalRow
                  - pageNumber
                  - data
                  - totalPage
                  - isLastPage
                  - pageSize
                  - isFirstPage
                  - status
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 默认模块/开放平台接口/巡检/整改单
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/2703503/apis/api-292089420-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```

