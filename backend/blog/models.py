from django.db import models
from django.contrib.auth.models import User


class Category(models.Model):
    name = models.CharField("分类名称", max_length=50)
    slug = models.SlugField("URL标识", max_length=50, unique=True)
    description = models.TextField("描述", blank=True)
    order = models.IntegerField("排序", default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name = "分类"
        verbose_name_plural = "分类"

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField("标签名称", max_length=50)
    slug = models.SlugField("URL标识", max_length=50, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "标签"
        verbose_name_plural = "标签"

    def __str__(self):
        return self.name


class Post(models.Model):
    title = models.CharField("标题", max_length=200)
    slug = models.SlugField("URL标识", max_length=200, unique=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="作者")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, verbose_name="分类")
    tags = models.ManyToManyField(Tag, blank=True, verbose_name="标签")
    content = models.TextField("内容", blank=True, default="")
    summary = models.TextField("摘要", max_length=500, blank=True)
    featured_image = models.ImageField("封面图片", upload_to="blog/", blank=True, null=True)
    wechat_link = models.URLField("微信链接", max_length=500, blank=True, null=True, help_text="微信公众号文章链接")
    status = models.CharField("状态", max_length=10, choices=[("draft", "草稿"), ("published", "已发布")], default="draft")
    show_on_homepage = models.BooleanField("首页推荐", default=False, help_text="是否展示在官网首页资讯区域")
    homepage_order = models.PositiveIntegerField("首页排序", default=0, help_text="数值越小越靠前")
    views = models.IntegerField("浏览量", default=0)
    published_at = models.DateTimeField("发布时间", null=True, blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["-published_at"]
        verbose_name = "博客文章"
        verbose_name_plural = "博客文章"

    def __str__(self):
        return self.title
