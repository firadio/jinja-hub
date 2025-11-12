// 通用地域加载 Mixin
function regionMixin() {
    return {
        regions: [],
        regionsLoading: false,

        async loadRegions() {
            if (this.regionsLoading || this.regions.length > 0) return;

            this.regionsLoading = true;
            try {
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    // 未登录时使用默认地域列表
                    this.regions = [{ id: 'cn-hangzhou', name: '华东1(杭州)' }];
                    if (!this.regionId) {
                        this.regionId = this.regions[0].id;
                    }
                    return;
                }

                // 使用新的 RegionManager 加载地域列表
                const regions = await window.appStore.regions.load(
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                this.regions = regions;

                // 确保regionId有效
                if (this.regions.length > 0) {
                    if (!this.regionId || !this.regions.find(r => r.id === this.regionId)) {
                        this.regionId = this.regions[0].id;
                    }
                }
            } catch (e) {
                console.error('Failed to load regions:', e);
                this.regions = [{ id: 'cn-hangzhou', name: '华东1(杭州)' }];
                if (!this.regionId) {
                    this.regionId = this.regions[0].id;
                }
            } finally {
                this.regionsLoading = false;
            }
        }
    };
}
